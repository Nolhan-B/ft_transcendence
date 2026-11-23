import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { GameMode, GameStatus, type ServerEvent } from "shared";
import { RawData } from "ws";
import { InternalGameState } from "../engine/game-state.js";
import {
  sendError,
  validateMessage,
  filterStateForPlayer,
  toRoomInfo,
  filterStateForSpectator,
  NO_LIVE_STATE,
  type LiveState,
  unoKey,
} from "./utils.js";
import {
  handleJoinGame,
  handlePlayCard,
  handleDrawCard,
  handleCallUno,
  handleCatchUno,
  handleChallengeBluff,
  handleAcceptWildDraw4,
  handleSpectateGame,
  handleLeaveSpectate,
} from "./handlers/game/index.js";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleUpdateRoom,
  handleStartGame,
  handleAddBot,
  handleRemoveBot,
} from "./handlers/room/index.js";
import { handleChatMessage } from "./handlers/chat/index.js";
import type { GatewayContext } from "./types.js";
import {
  advanceToNextPlayer,
  finishPlayer,
  recordAction,
} from "../engine/game-state.js";
import {
  continueTurn,
  scheduleBotTurnIfNeeded,
} from "./handlers/game/bot-turn.js";
import { handleJoinQueue } from "./handlers/matchmaking/join-queue.js";
import { handleLeaveQueue } from "./handlers/matchmaking/leave-queue.js";
import { findMatch } from "../engine/matchmaking.js";
import { computeEloChanges } from "../engine/elo.js";

const ALIVE_CHECK_MS = Number(process.env.ALIVE_CHECK_MS) || 2000;

// true si le socket répond encore, false s'il se ferme ou ne répond pas
function isStillAlive(ws: WebSocket): Promise<boolean> {
  if (ws.readyState !== WebSocket.OPEN) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (alive: boolean) => {
      clearTimeout(timer);
      ws.off("pong", onPong);
      ws.off("close", onClose);
      resolve(alive);
    };
    const onPong = () => done(true);
    const onClose = () => done(false);
    const timer = setTimeout(() => {
      ws.terminate(); // connexion morte : on la tue, ça déclenche son "close"
      done(false);
    }, ALIVE_CHECK_MS);
    ws.on("pong", onPong);
    ws.on("close", onClose);
    ws.ping();
  });
}

const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS) || 20000;
const MAX_AFK_COUNT = 2;

const rooms: Map<
  string,
  Set<{ socket: WebSocket; userId: string }>
> = new Map();
const roomSockets: Map<
  string,
  Set<{ socket: WebSocket; userId: string }>
> = new Map();
const connectedUser: Map<string, WebSocket> = new Map();
const chatLogs: Map<
  string,
  { userId: string; username: string; content: string; time: string }[]
> = new Map();
const moveLogs: Map<
  string,
  {
    userId: string;
    action: string;
    cardId?: string;
    cardColor?: string;
    cardValue?: string;
    chosenColor?: string;
    time: string;
  }[]
> = new Map();
const unoTimers: Map<string, NodeJS.Timeout> = new Map();
const bluffTimers: Map<string, NodeJS.Timeout> = new Map();
const turnTimers: Map<string, NodeJS.Timeout> = new Map();
// Heure de fin du chrono en cours, par partie (pour envoyer le temps restant)
const turnDeadlines: Map<string, number> = new Map();
const afkCounts: Map<string, number> = new Map();

const spectators: Map<
  string,
  Set<{ socket: WebSocket; userId: string }>
> = new Map();

const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 30000;

const MATCHMAKING_TICK_MS = Number(process.env.MATCHMAKING_TICK_MS) || 2000;
const GAME_JOIN_TIMEOUT_MS = Number(process.env.GAME_JOIN_TIMEOUT_MS) || 15000;

export default async function gameGateway(fastify: FastifyInstance) {
  const manager = fastify.gameManager;
  const roomManager = fastify.roomManager;
  const queueManager = fastify.queueManager;

  function broadCastToRoom(
    gameId: string,
    event: ServerEvent,
    excludeUserId?: string,
  ): void {
    const data = JSON.stringify(event);

    const room = rooms.get(gameId);
    if (room) {
      for (const client of room) {
        if (client.userId !== excludeUserId) {
          client.socket.send(data);
        }
      }
    }

    const watchers = spectators.get(gameId);
    if (watchers) {
      for (const client of watchers) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(data);
        }
      }
    }
  }

  // Champs calcules au moment de l'envoi (chronos, sockets)
  function liveState(game: InternalGameState): LiveState {
    if (game.status === GameStatus.FINISHED) return NO_LIVE_STATE;
    const current = game.players.find((p) => p.isCurrentTurn);
    const deadline = turnDeadlines.get(game.id);
    const bluff = game.lastWildDraw4;
    // Pas de chrono affiche pour un bot (il joue apres un court delai), ni
    // pendant un +4 en attente : c'est alors le delai du bluff qui compte
    const timed =
      current !== undefined &&
      !current.userId.startsWith("bot_") &&
      deadline !== undefined &&
      !bluff;
    return {
      ...NO_LIVE_STATE,
      turnTimeLeftMs: timed ? Math.max(0, deadline - Date.now()) : null,
      // Socket ferme, delai de reconnexion en cours (pas encore exclus)
      reconnecting: game.players
        .filter(
          (p) =>
            !p.disconnected && disconnectTimers.has(`${game.id}:${p.userId}`),
        )
        .map((p) => p.userId),
      // A 1 carte, sans avoir dit UNO, fenetre encore ouverte
      unoVulnerable: game.players
        .filter(
          (p) =>
            !p.disconnected &&
            p.hand.length === 1 &&
            unoTimers.has(unoKey(game.id, p.userId)),
        )
        .map((p) => p.userId),
      // Version publique : sans hadMatchingColor, qui doit rester secret
      pendingWildDraw4:
        bluff && current
          ? {
              playerId: bluff.playerId,
              targetId: current.userId,
              timeLeftMs:
                bluff.expiresAt !== undefined
                  ? Math.max(0, bluff.expiresAt - Date.now())
                  : 0,
            }
          : null,
    };
  }

  function broadCastStateToRoom(
    gameId: string,
    state: InternalGameState,
  ): void {
    // Les actions notees depuis le dernier envoi deviennent lastActions. Si rien
    // de neuf, lastActions reste le dernier lot (memes seq : le client l'ignore)
    if (state.pendingActions.length > 0) {
      state.lastActions = state.pendingActions;
      state.pendingActions = [];
    }
    const live = liveState(state);
    const room = rooms.get(gameId);
    if (room) {
      for (const client of room) {
        const playerGameState = filterStateForPlayer(
          state,
          client.userId,
          live,
        );
        client.socket.send(
          JSON.stringify({ type: "game_updated", state: playerGameState }),
        );
      }
    }

    const watchers = spectators.get(gameId);
    if (watchers) {
      const data = JSON.stringify({
        type: "game_updated",
        state: filterStateForSpectator(state, live),
      });
      for (const client of watchers) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(data);
        }
      }
    }
  }

  function broadcastToRoomSockets(roomCode: string, event: ServerEvent): void {
    const sockets = roomSockets.get(roomCode);
    if (!sockets) return;
    const data = JSON.stringify(event);
    for (const client of sockets) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  // ctx sert a relancer le bot quand le timer lui passe la main
  function startTurnTimer(gameId: string, ctx: GatewayContext): void {
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
    }
    const game = manager.getGame(gameId);
    if (!game || game.status === GameStatus.FINISHED) return;
    const currentPlayer = game.players.find((p) => p.isCurrentTurn);
    if (!currentPlayer) return;

    const timer = setTimeout(async () => {
      turnTimers.delete(gameId);
      turnDeadlines.delete(gameId);
      const game = manager.getGame(gameId);
      if (!game || game.status === GameStatus.FINISHED) return;
      const room = rooms.get(gameId);
      if (!room || room.size === 0) return;
      const currentPlayer = game.players.find((p) => p.isCurrentTurn);
      if (!currentPlayer) return;

      // Un +4 attend une reponse : c'est le timer de bluff qui tranche
      if (game.lastWildDraw4) {
        startTurnTimer(gameId, ctx);
        return;
      }

      // Chrono perime tombe sur le tour d'un bot : on ne le compte pas AFK,
      // on le relance (filet de securite si son coup n'est jamais parti)
      if (currentPlayer.userId.startsWith("bot_")) {
        scheduleBotTurnIfNeeded(ctx, game, gameId);
        startTurnTimer(gameId, ctx);
        return;
      }

      const afkKey = `${gameId}:${currentPlayer.userId}`;
      const count = (afkCounts.get(afkKey) ?? 0) + 1;
      afkCounts.set(afkKey, count);

      if (count >= MAX_AFK_COUNT) {
        currentPlayer.disconnected = true;
        recordAction(game, {
          type: "player_kicked",
          userId: currentPlayer.userId,
          reason: "afk",
          auto: true,
        });
        const activePlayers = game.players.filter((p) => !p.disconnected);
        if (activePlayers.length <= 1) {
          await endGame(gameId, game);
          return;
        }
        broadCastToRoom(gameId, {
          type: "player_left",
          userId: currentPlayer.userId,
          reason: "afk",
        });
        advanceToNextPlayer(game);
        game.drawPileCount = game.drawPile.length;
      } else {
        manager.drawCard(gameId, currentPlayer.userId, true);
      }

      // Le suivant peut etre un bot : il doit jouer, pas attendre le chrono.
      // Avant l'envoi, pour que l'etat contienne le nouveau chrono
      continueTurn(ctx, game);
      broadCastStateToRoom(gameId, game);
    }, TURN_TIMEOUT_MS);

    turnTimers.set(gameId, timer);
    turnDeadlines.set(gameId, Date.now() + TURN_TIMEOUT_MS);
  }

  async function updateElo(game: InternalGameState): Promise<void> {
    const ranked = [...game.ranking];
    for (const p of game.players) {
      if (!ranked.includes(p.userId) && !p.disconnected) ranked.push(p.userId);
    }
    for (const p of game.players) {
      if (!ranked.includes(p.userId)) ranked.push(p.userId);
    }

    const users = await fastify.prisma.user.findMany({
      where: { id: { in: ranked } },
      select: { id: true, elo: true },
    });
    const eloById = new Map(users.map((u) => [u.id, u.elo]));

    const abandoned = game.players
      .filter((p) => p.disconnected && !game.ranking.includes(p.userId))
      .map((p) => p.userId);

    const changes = computeEloChanges(
      ranked
        .filter((id) => eloById.has(id))
        .map((id) => ({ userId: id, elo: eloById.get(id)! })),
      abandoned,
    );

    await fastify.prisma.$transaction(
      changes.map((c) =>
        fastify.prisma.user.update({
          where: { id: c.userId },
          data: { elo: c.newElo },
        }),
      ),
    );

    broadCastToRoom(game.id, { type: "elo_updated", changes });
  }

  async function endGame(
    gameId: string,
    game: InternalGameState,
  ): Promise<void> {
    // Fin par un coup (derniere carte) : l'etat final a deja ete diffuse par le
    // handler. Fin par abandon ou AFK : pas encore, on le fait plus bas
    const finalStateSent = game.status === GameStatus.FINISHED;
    game.status = GameStatus.FINISHED;
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
      turnTimers.delete(gameId);
    }
    turnDeadlines.delete(gameId);
    for (const [key, timer] of disconnectTimers) {
      if (key.startsWith(`${gameId}:`)) {
        clearTimeout(timer);
        disconnectTimers.delete(key);
      }
    }
    for (const key of afkCounts.keys()) {
      if (key.startsWith(`${gameId}:`)) afkCounts.delete(key);
    }
    for (const [key, timer] of unoTimers) {
      if (key.startsWith(`${gameId}:`)) {
        clearTimeout(timer);
        unoTimers.delete(key);
      }
    }
    if (bluffTimers.has(gameId)) {
      clearTimeout(bluffTimers.get(gameId));
      bluffTimers.delete(gameId);
    }
    if (!game.winnerId) {
      const activePlayers = game.players.filter((p) => !p.disconnected);
      // Partie finie par abandons : le dernier joueur encore en jeu se classe
      // juste apres ceux qui ont deja fini (en ranked, un joueur a pu finir avant)
      const last = activePlayers.length === 1 ? activePlayers[0] : null;
      if (last && !game.ranking.includes(last.userId)) {
        finishPlayer(game, last.userId);
      }
      game.winnerId = game.ranking[0] ?? null;
    }
    game.lastWildDraw4 = undefined;
    // Etat final (classement complet, gagnant, player_finished) avant game_ended
    if (!finalStateSent || game.pendingActions.length > 0) {
      broadCastStateToRoom(gameId, game);
    }
    broadCastToRoom(gameId, {
      type: "game_ended",
      winnerId: game.winnerId ?? "",
      ranking: game.ranking,
    });
    // Une erreur de base de donnees ne doit ni faire planter le service
    // (endGame est souvent appele depuis un setTimeout), ni laisser la partie en memoire
    try {
      if (game.mode === GameMode.RANKED) {
        await updateElo(game);
      }
      await fastify.prisma.match.create({
        data: {
          mode: game.mode,
          players: game.players.map((p) => p.userId),
          ranking: game.ranking,
          winnerId: game.winnerId ?? "",
          chatLog: chatLogs.get(gameId) ?? [],
          moveLog: moveLogs.get(gameId) ?? [],
          // Sans ca, startedAt prenait la valeur par defaut now() a l'enregistrement,
          // soit la meme que endedAt : la duree de la partie valait toujours 0
          startedAt: game.startedAt,
          endedAt: new Date(),
        },
      });
    } catch (err) {
      fastify.log.error({ err, gameId }, "Failed to save game result");
    } finally {
      chatLogs.delete(gameId);
      moveLogs.delete(gameId);
      rooms.delete(gameId);
      spectators.delete(gameId);
      manager.removeGame(gameId);
    }
  }

  // Partie creee mais jamais rejointe (onglet ferme, joueur parti) : sans ce
  // nettoyage elle reste en memoire et bloque ses joueurs ("Already in a game").
  // On teste "personne n'a jamais rejoint" et pas "salle vide", pour ne pas
  // supprimer une partie dont les joueurs sont en train de se reconnecter
  function cancelGameIfNeverJoined(gameId: string): void {
    setTimeout(() => {
      if (manager.getGame(gameId) && !rooms.has(gameId)) {
        manager.removeGame(gameId);
      }
    }, GAME_JOIN_TIMEOUT_MS);
  }

  function runMatchmaking(): void {
    const now = Date.now();
    let group = findMatch(queueManager.list(), now);

    while (group) {
      queueManager.removeMany(group.map((e) => e.userId));

      const gameId = manager.createGame(
        group.map((e) => ({ id: e.userId, username: e.username })),
        GameMode.RANKED,
      );

      if (gameId) {
        const event = JSON.stringify({
          type: "match_found",
          gameId,
          players: group.map((e) => ({
            id: e.userId,
            username: e.username,
            elo: e.elo,
          })),
        });
        for (const e of group) {
          const socket = connectedUser.get(e.userId);
          if (socket?.readyState === WebSocket.OPEN) socket.send(event);
        }

        // Si personne ne rejoint la partie, on l'annule sans toucher a l'ELO
        cancelGameIfNeverJoined(gameId);
      }

      group = findMatch(queueManager.list(), now);
    }
  }

  const matchmakingInterval = setInterval(runMatchmaking, MATCHMAKING_TICK_MS);
  fastify.addHook("onClose", async () => clearInterval(matchmakingInterval));

  fastify.get("/ws", { websocket: true }, async (socket, request) => {
    const token = request.cookies.access_token;
    if (!token) {
      sendError(socket, "Unauthorized");
      socket.close();
      return;
    }

    let userId: string;
    try {
      const payload = fastify.jwt.verify(token) as { id: string };
      userId = payload.id;
    } catch {
      sendError(socket, "Invalid token");
      socket.close();
      return;
    }

    // Les messages qui arrivent pendant la vérification sont gardés de côté
    const pending: RawData[] = [];
    const buffer = (data: RawData) => pending.push(data);
    socket.on("message", buffer);

    // Refresh : l'ancien socket est mort ou en train de se fermer → on accepte
    // Deuxième onglet : l'ancien répond au ping → on refuse
    const existing = connectedUser.get(userId);
    if (existing && existing !== socket && (await isStillAlive(existing))) {
      sendError(socket, "Already connected");
      socket.close();
      return;
    }

    // Le nouveau client a pu abandonner pendant l'attente
    if (socket.readyState !== WebSocket.OPEN) return;

    connectedUser.set(userId, socket);

    const ctx: GatewayContext = {
      fastify,
      socket,
      userId,
      manager,
      roomManager,
      queueManager,
      rooms,
      roomSockets,
      chatLogs,
      moveLogs,
      unoTimers,
      bluffTimers,
      turnTimers,
      afkCounts,
      disconnectTimers,
      spectators,
      broadCastToRoom,
      broadCastStateToRoom,
      broadcastToRoomSockets,
      sendError,
      startTurnTimer: (gameId) => startTurnTimer(gameId, ctx),
      liveState,
      endGame,
      cancelGameIfNeverJoined,
      toRoomInfo,
    };

    const onMessage = async (data: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        sendError(socket, "Invalid JSON");
        return;
      }

      const message = validateMessage(parsed);
      if (!message) {
        sendError(socket, "Invalid message format");
        return;
      }

      // Un handler qui plante (erreur Prisma, bug) ne doit pas tuer le service :
      // sans ce catch, la promesse rejetee arrete tout le processus Node
      try {
        switch (message.type) {
          case "join_game":
            await handleJoinGame(ctx, message);
            break;
          case "play_card":
            await handlePlayCard(ctx, message);
            break;
          case "draw_card":
            await handleDrawCard(ctx, message);
            break;
          case "call_uno":
            handleCallUno(ctx, message);
            break;
          case "catch_uno":
            handleCatchUno(ctx, message);
            break;
          case "challenge_bluff":
            await handleChallengeBluff(ctx, message);
            break;
          case "accept_wild_draw4":
            handleAcceptWildDraw4(ctx, message);
            break;
          case "chat_message":
            handleChatMessage(ctx, message);
            break;
          case "create_room":
            await handleCreateRoom(ctx, message);
            break;
          case "join_room":
            await handleJoinRoom(ctx, message);
            break;
          case "leave_room":
            handleLeaveRoom(ctx, message);
            break;
          case "update_room":
            handleUpdateRoom(ctx, message);
            break;
          case "start_game":
            handleStartGame(ctx, message);
            break;
          case "add_bot":
            handleAddBot(ctx, message);
            break;
          case "remove_bot":
            handleRemoveBot(ctx, message);
            break;
          case "spectate_game":
            handleSpectateGame(ctx, message);
            break;
          case "leave_spectate":
            handleLeaveSpectate(ctx, message);
            break;
          case "join_queue":
            await handleJoinQueue(ctx);
            break;
          case "leave_queue":
            handleLeaveQueue(ctx);
            break;
        }
      } catch (err) {
        fastify.log.error(
          { err, userId, type: message.type },
          "WebSocket handler failed",
        );
        sendError(socket, "Internal server error");
      }
    };

    socket.on("close", async () => {
      // L'ancien socket peut se fermer après l'arrivée du nouveau :
      // il ne doit pas effacer ce qui appartient au nouveau
      const isCurrent = connectedUser.get(userId) === socket;
      if (isCurrent) queueManager.leave(userId);

      for (const [gameId, watchers] of spectators) {
        for (const client of watchers) {
          if (client.socket === socket) watchers.delete(client);
        }
        if (watchers.size === 0) spectators.delete(gameId);
      }

      for (const [gameId, room] of rooms) {
        let found = false;
        for (const client of room) {
          if (client.socket === socket) {
            room.delete(client);
            found = true;
            break;
          }
        }
        if (!found) continue;
        if ([...room].some((c) => c.userId === userId)) continue; // deja revenu

        broadCastToRoom(gameId, {
          type: "player_left",
          userId,
          reason: "disconnected",
        });

        const key = `${gameId}:${userId}`;
        if (disconnectTimers.has(key)) clearTimeout(disconnectTimers.get(key));

        disconnectTimers.set(
          key,
          setTimeout(async () => {
            disconnectTimers.delete(key);
            const game = manager.getGame(gameId);
            if (!game || game.status !== GameStatus.IN_PROGRESS) return;

            // Le joueur est revenu entre temps
            const currentRoom = rooms.get(gameId);
            if (
              currentRoom &&
              [...currentRoom].some((c) => c.userId === userId)
            )
              return;

            const player = game.players.find((p) => p.userId === userId);
            if (player) {
              player.disconnected = true;
              recordAction(game, {
                type: "player_kicked",
                userId,
                reason: "abandoned",
                auto: true,
              });
              broadCastToRoom(gameId, {
                type: "player_left",
                userId,
                reason: "abandoned",
              });
            }

            const activePlayers = game.players.filter((p) => !p.disconnected);
            if (
              activePlayers.length <= 1 ||
              !currentRoom ||
              currentRoom.size === 0
            ) {
              await endGame(gameId, game);
              return;
            }

            // C'etait son tour : on passe au suivant sans attendre l'AFK
            if (player?.isCurrentTurn) {
              advanceToNextPlayer(game);
              game.drawPileCount = game.drawPile.length;
              continueTurn(ctx, game);
            }
            // Toujours diffuser : hors de son tour, les autres clients le voyaient
            // encore en jeu jusqu'au coup suivant
            broadCastStateToRoom(gameId, game);
          }, RECONNECT_GRACE_MS),
        );
        // Apres la pose du timer : l'etat le liste dans reconnecting
        const game = manager.getGame(gameId);
        if (game) broadCastStateToRoom(gameId, game);
      }

      for (const [roomCode, sockets] of roomSockets) {
        for (const client of sockets) {
          if (client.socket === socket) {
            sockets.delete(client);
            // Le joueur est deja revenu avec un autre socket : on ne le retire pas
            const stillHere = [...sockets].some((c) => c.userId === userId);
            if (!stillHere) {
              roomManager.leaveRoom(roomCode, userId);
              const room = roomManager.getRoom(roomCode);
              if (room) {
                broadcastToRoomSockets(roomCode, {
                  type: "room_updated",
                  room: toRoomInfo(room),
                });
              } else {
                roomSockets.delete(roomCode);
              }
            }
            break;
          }
        }
      }

      if (isCurrent) connectedUser.delete(userId);
    });

    // On branche le vrai handler et on rejoue les messages gardés de côté
    socket.off("message", buffer);
    socket.on("message", onMessage);
    socket.send(JSON.stringify({ type: "connected" }));
    for (const data of pending) await onMessage(data);
  });
}
