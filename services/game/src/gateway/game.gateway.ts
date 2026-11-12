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
import { advanceToNextPlayer } from "../engine/game-state.js";
import { scheduleBotTurnIfNeeded } from "./handlers/game/bot-turn.js";
import { handleJoinQueue } from "./handlers/matchmaking/join-queue.js";
import { handleLeaveQueue } from "./handlers/matchmaking/leave-queue.js";
import { findMatch } from "../engine/matchmaking.js";
import { computeEloChanges } from "../engine/elo.js";

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
const afkCounts: Map<string, number> = new Map();

const spectators: Map<
  string,
  Set<{ socket: WebSocket; userId: string }>
> = new Map();

const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 30000;

const MATCHMAKING_TICK_MS = Number(process.env.MATCHMAKING_TICK_MS) || 2000;
const MATCH_JOIN_TIMEOUT_MS =
  Number(process.env.MATCH_JOIN_TIMEOUT_MS) || 15000;

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

  function broadCastStateToRoom(
    gameId: string,
    state: InternalGameState,
  ): void {
    const room = rooms.get(gameId);
    if (room) {
      for (const client of room) {
        const playerGameState = filterStateForPlayer(state, client.userId);
        client.socket.send(
          JSON.stringify({ type: "game_updated", state: playerGameState }),
        );
      }
    }

    const watchers = spectators.get(gameId);
    if (watchers) {
      const data = JSON.stringify({
        type: "game_updated",
        state: filterStateForSpectator(state),
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

  function startTurnTimer(gameId: string): void {
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
    }
    const game = manager.getGame(gameId);
    if (!game || game.status === GameStatus.FINISHED) return;
    const currentPlayer = game.players.find((p) => p.isCurrentTurn);
    if (!currentPlayer) return;

    const timer = setTimeout(async () => {
      turnTimers.delete(gameId);
      const game = manager.getGame(gameId);
      if (!game || game.status === GameStatus.FINISHED) return;
      const room = rooms.get(gameId);
      if (!room || room.size === 0) return;
      const currentPlayer = game.players.find((p) => p.isCurrentTurn);
      if (!currentPlayer) return;

      const afkKey = `${gameId}:${currentPlayer.userId}`;
      const count = (afkCounts.get(afkKey) ?? 0) + 1;
      afkCounts.set(afkKey, count);

      if (count >= MAX_AFK_COUNT) {
        currentPlayer.disconnected = true;
        const activePlayers = game.players.filter((p) => !p.disconnected);
        if (activePlayers.length <= 1) {
          await endGame(gameId, game);
          return;
        }
        broadCastToRoom(gameId, {
          type: "player_left",
          userId: currentPlayer.userId,
        });
        advanceToNextPlayer(game);
        game.drawPileCount = game.drawPile.length;
        broadCastStateToRoom(gameId, game);
      } else {
        manager.drawCard(gameId, currentPlayer.userId);
        broadCastStateToRoom(gameId, game);
      }

      startTurnTimer(gameId);
    }, TURN_TIMEOUT_MS);

    turnTimers.set(gameId, timer);
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
    game.status = GameStatus.FINISHED;
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
      turnTimers.delete(gameId);
    }
    for (const [key, timer] of disconnectTimers) {
      if (key.startsWith(`${gameId}:`)) {
        clearTimeout(timer);
        disconnectTimers.delete(key);
      }
    }
    for (const key of afkCounts.keys()) {
      if (key.startsWith(`${gameId}:`)) afkCounts.delete(key);
    }
    if (bluffTimers.has(gameId)) {
      clearTimeout(bluffTimers.get(gameId));
      bluffTimers.delete(gameId);
    }
    if (!game.winnerId) {
      const activePlayers = game.players.filter((p) => !p.disconnected);
      game.winnerId =
        activePlayers.length === 1 ? activePlayers[0].userId : null;
    }
    broadCastToRoom(gameId, {
      type: "game_ended",
      winnerId: game.winnerId ?? "",
    });
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
      },
    });
    chatLogs.delete(gameId);
    moveLogs.delete(gameId);
    rooms.delete(gameId);
    spectators.delete(gameId);
    manager.removeGame(gameId);
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

        // Si personne ne rejoint la partie, on l'annule sans toucher à l'ELO
        setTimeout(() => {
          const game = manager.getGame(gameId);
          const room = rooms.get(gameId);
          if (game && (!room || room.size === 0)) manager.removeGame(gameId);
        }, MATCH_JOIN_TIMEOUT_MS);
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

    if (connectedUser.has(userId)) {
      const existing = connectedUser.get(userId)!;
      if (existing.readyState === WebSocket.OPEN) {
        sendError(socket, "Already connected");
        socket.close();
        return;
      }
    }
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
      startTurnTimer,
      endGame,
      toRoomInfo,
    };

    socket.on("message", async (data: RawData) => {
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
          handleCallUno(ctx);
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
    });

    socket.on("close", async () => {
      queueManager.leave(userId);
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

        broadCastToRoom(gameId, { type: "player_left", userId });

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
            if (player) player.disconnected = true;

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
              broadCastStateToRoom(gameId, game);
              scheduleBotTurnIfNeeded(ctx, game, gameId);
              const next = game.players.find((p) => p.isCurrentTurn);
              if (!next?.userId.startsWith("bot_")) startTurnTimer(gameId);
            }
          }, RECONNECT_GRACE_MS),
        );
      }

      for (const [roomCode, sockets] of roomSockets) {
        for (const client of sockets) {
          if (client.socket === socket) {
            sockets.delete(client);
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
            break;
          }
        }
      }

      connectedUser.delete(userId);
    });

    socket.send(JSON.stringify({ type: "connected" }));
  });
}
