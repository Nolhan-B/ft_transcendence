import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { GameStatus, type ServerEvent } from "shared";
import { RawData } from "ws";
import { InternalGameState } from "../engine/game-state.js";
import {
  sendError,
  validateMessage,
  filterStateForPlayer,
  toRoomInfo,
} from "./utils.js";
import {
  handleJoinGame,
  handlePlayCard,
  handleDrawCard,
  handleCallUno,
  handleCatchUno,
  handleChallengeBluff,
  handleAcceptWildDraw4,
} from "./handlers/game/index.js";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleUpdateRoom,
  handleStartGame,
} from "./handlers/room/index.js";
import { handleChatMessage } from "./handlers/chat/index.js";
import type { GatewayContext } from "./types.js";
import { advanceToNextPlayer } from "../engine/game-state.js";

const TURN_TIMEOUT_MS = 20000;
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

export default async function gameGateway(fastify: FastifyInstance) {
  const manager = fastify.gameManager;
  const roomManager = fastify.roomManager;

  function broadCastToRoom(
    gameId: string,
    event: ServerEvent,
    excludeUserId?: string,
  ): void {
    const room = rooms.get(gameId);
    if (!room) return;
    const data = JSON.stringify(event);
    for (const client of room) {
      if (client.userId !== excludeUserId) {
        client.socket.send(data);
      }
    }
  }

  function broadCastStateToRoom(
    gameId: string,
    state: InternalGameState,
  ): void {
    const room = rooms.get(gameId);
    if (!room) return;
    for (const client of room) {
      const playerGameState = filterStateForPlayer(state, client.userId);
      client.socket.send(
        JSON.stringify({ type: "game_updated", state: playerGameState }),
      );
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

  async function endGame(
    gameId: string,
    game: InternalGameState,
  ): Promise<void> {
    game.status = GameStatus.FINISHED;
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
      turnTimers.delete(gameId);
    }
    const activePlayers = game.players.filter((p) => !p.disconnected);
    game.winnerId = activePlayers.length === 1 ? activePlayers[0].userId : null;
    broadCastToRoom(gameId, {
      type: "game_ended",
      winnerId: game.winnerId ?? "",
    });
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
    manager.removeGame(gameId);
  }

  fastify.get("/ws", { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token;
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
      rooms,
      roomSockets,
      chatLogs,
      moveLogs,
      unoTimers,
      bluffTimers,
      turnTimers,
      afkCounts,
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
      }
    });

    socket.on("close", async () => {
      for (const [gameId, room] of rooms) {
        for (const client of room) {
          if (client.socket === socket) {
            room.delete(client);
            broadCastToRoom(gameId, { type: "player_left", userId });
            break;
          }
        }
        if (room.size === 0) {
          rooms.delete(gameId);
        }
        const game = manager.getGame(gameId);
        if (game && game.status === GameStatus.IN_PROGRESS) {
          const activePlayers = game.players.filter((p) => !p.disconnected);
          if (activePlayers.length <= 1) {
            await endGame(gameId, game);
          }
        }
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
