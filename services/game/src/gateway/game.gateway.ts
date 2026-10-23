import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import {
  CardColor,
  CardValue,
  GameStatus,
  type ClientMessage,
  type GameState,
  type ServerEvent,
} from "shared";
import { RawData } from "ws";
import {
  InternalGameState,
  advanceToNextPlayer,
  drawCardsForPlayer,
} from "../engine/game-state.js";
import { Room } from "../managers/room.manager.js";
import type { RoomInfo } from "shared";

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

  function startTurnTimer(gameId: string): void {
    if (turnTimers.has(gameId)) {
      clearTimeout(turnTimers.get(gameId));
    }

    const game = manager.getGame(gameId);
    if (!game || game.status === GameStatus.FINISHED) return;

    const currentPlayer = game.players.find((p) => p.isCurrentTurn);
    if (!currentPlayer) return;

    const timer = setTimeout(() => {
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

    socket.on("message", async (data: RawData) => {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case "join_game": {
          const game = manager.getGame(message.gameId);
          if (game === undefined) {
            sendError(socket, "Game not found");
            break;
          }
          const isPlayer = game.players.some((p) => p.userId === userId);
          if (!isPlayer) {
            sendError(socket, "You are not part of this game");
            break;
          }
          if (!rooms.has(message.gameId)) {
            rooms.set(message.gameId, new Set());
          }
          rooms.get(message.gameId)!.add({ socket, userId });

          broadCastToRoom(
            message.gameId,
            { type: "player_joined", userId },
            userId,
          );

          const playerGameState = filterStateForPlayer(game, userId);

          socket.send(
            JSON.stringify({ type: "game_updated", state: playerGameState }),
          );

          startTurnTimer(message.gameId);

          break;
        }
        case "play_card": {
          const game = manager.getGame(message.gameId);
          if (game === undefined) {
            sendError(socket, "Game not found");
            break;
          }
          const updatedState = manager.playCard(
            game.id,
            userId,
            message.cardId,
            message.chosenColor,
            message.targetUserId,
          );
          if (!updatedState) {
            sendError(socket, "Invalid move");
            break;
          }

          if (!moveLogs.has(updatedState.id)) moveLogs.set(updatedState.id, []);

          moveLogs.get(updatedState.id)!.push({
            userId,
            action: "play_card",
            cardId: message.cardId,
            cardColor: updatedState.topCard.color,
            cardValue: updatedState.topCard.value,
            chosenColor: message.chosenColor,
            time: new Date().toISOString(),
          });

          broadCastStateToRoom(updatedState.id, updatedState);

          if (updatedState.settings.unoCallout) {
            const playerHand = updatedState.players.find(
              (p) => p.userId === userId,
            )?.hand;
            if (playerHand && playerHand.length === 1) {
              unoTimers.set(
                userId,
                setTimeout(() => {
                  unoTimers.delete(userId);
                }, 5000),
              );
            }
          }

          if (
            updatedState.lastWildDraw4 &&
            updatedState.settings.bluffChallenge
          ) {
            const targetId = updatedState.players.find(
              (p) => p.isCurrentTurn,
            )?.userId;
            if (targetId) {
              bluffTimers.set(
                updatedState.id,
                setTimeout(() => {
                  bluffTimers.delete(updatedState.id);
                  drawCardsForPlayer(updatedState, targetId, 4);
                  updatedState.lastWildDraw4 = undefined;
                  advanceToNextPlayer(updatedState);
                  broadCastStateToRoom(updatedState.id, updatedState);
                }, 5000),
              );
            }
          }

          afkCounts.set(`${game.id}:${userId}`, 0);
          startTurnTimer(game.id);

          if (updatedState.status === GameStatus.FINISHED) {
            if (turnTimers.has(updatedState.id)) {
              clearTimeout(turnTimers.get(updatedState.id));
              turnTimers.delete(updatedState.id);
            }
            broadCastToRoom(updatedState.id, {
              type: "game_ended",
              winnerId: updatedState.winnerId!,
            });
            await fastify.prisma.match.create({
              data: {
                mode: updatedState.mode,
                players: updatedState.players.map((p) => p.userId),
                ranking: updatedState.ranking,
                winnerId: updatedState.winnerId!,
                chatLog: chatLogs.get(updatedState.id) ?? [],
                moveLog: moveLogs.get(updatedState.id) ?? [],
              },
            });
            chatLogs.delete(updatedState.id);
            moveLogs.delete(updatedState.id);

            rooms.delete(updatedState.id);
            manager.removeGame(updatedState.id);
          }
          break;
        }
        case "call_uno": {
          if (unoTimers.has(userId)) {
            clearTimeout(unoTimers.get(userId));
            unoTimers.delete(userId);
          }
          break;
        }
        case "catch_uno": {
          const target = message.targetUserId;
          if (!unoTimers.has(target)) {
            sendError(socket, "Player already called UNO or not in UNO state");
            break;
          }
          clearTimeout(unoTimers.get(target));
          unoTimers.delete(target);

          const game = manager.getGame(message.gameId);
          if (!game) break;

          const targetPlayer = game.players.find((p) => p.userId === target);
          if (targetPlayer) {
            for (let i = 0; i < 2; i++) {
              if (game.drawPile.length === 0) break;
              const card = game.drawPile.shift();
              if (card) targetPlayer.hand.push(card);
            }
            game.drawPileCount = game.drawPile.length;
          }

          broadCastToRoom(message.gameId, {
            type: "uno_caught",
            targetUserId: target,
            catcherUserId: userId,
          } as ServerEvent);
          broadCastStateToRoom(game.id, game);
          break;
        }
        case "challenge_bluff": {
          const game = manager.getGame(message.gameId);
          if (!game || !game.lastWildDraw4) {
            sendError(socket, "No bluff to challenge");
            break;
          }

          if (bluffTimers.has(game.id)) {
            clearTimeout(bluffTimers.get(game.id));
            bluffTimers.delete(game.id);
          }

          const { playerId: blufferId, hadMatchingColor } = game.lastWildDraw4;

          if (hadMatchingColor) {
            drawCardsForPlayer(game, blufferId, 4);
          } else {
            drawCardsForPlayer(game, userId, 6);
            advanceToNextPlayer(game);
          }

          broadCastToRoom(game.id, {
            type: "bluff_result",
            challengerUserId: userId,
            targetUserId: blufferId,
            wasBluff: hadMatchingColor,
            penaltyCount: hadMatchingColor ? 4 : 6,
          } as ServerEvent);

          game.lastWildDraw4 = undefined;
          broadCastStateToRoom(game.id, game);
          break;
        }
        case "accept_wild_draw4": {
          const game = manager.getGame(message.gameId);
          if (!game || !game.lastWildDraw4) {
            sendError(socket, "Nothing to accept");
            break;
          }

          if (bluffTimers.has(game.id)) {
            clearTimeout(bluffTimers.get(game.id));
            bluffTimers.delete(game.id);
          }

          drawCardsForPlayer(game, userId, 4);
          game.lastWildDraw4 = undefined;
          advanceToNextPlayer(game);
          broadCastStateToRoom(game.id, game);
          break;
        }
        case "draw_card": {
          const game = manager.getGame(message.gameId);
          if (!game) {
            sendError(socket, "Game not found");
            break;
          }
          const updatedState = manager.drawCard(game.id, userId);
          if (!updatedState) {
            sendError(socket, "Cannot draw card");
            break;
          }

          if (!moveLogs.has(updatedState.id)) moveLogs.set(updatedState.id, []);

          const currentPlayer = updatedState.players.find(
            (p) => p.userId === userId,
          );
          const drawnCard = currentPlayer?.hand[currentPlayer.hand.length - 1];

          moveLogs.get(updatedState.id)!.push({
            userId,
            action: "draw_card",
            cardId: drawnCard?.id,
            cardColor: drawnCard?.color,
            cardValue: drawnCard?.value,
            time: new Date().toISOString(),
          });

          broadCastStateToRoom(updatedState.id, updatedState);

          afkCounts.set(`${game.id}:${userId}`, 0);
          startTurnTimer(game.id);

          if (updatedState.status === GameStatus.FINISHED) {
            if (turnTimers.has(updatedState.id)) {
              clearTimeout(turnTimers.get(updatedState.id));
              turnTimers.delete(updatedState.id);
            }
            broadCastToRoom(updatedState.id, {
              type: "game_ended",
              winnerId: updatedState.winnerId!,
            });
            await fastify.prisma.match.create({
              data: {
                mode: updatedState.mode,
                players: updatedState.players.map((p) => p.userId),
                ranking: updatedState.ranking,
                winnerId: updatedState.winnerId!,
                chatLog: chatLogs.get(updatedState.id) ?? [],
                moveLog: moveLogs.get(updatedState.id) ?? [],
              },
            });
            chatLogs.delete(updatedState.id);
            moveLogs.delete(updatedState.id);
            rooms.delete(updatedState.id);
            manager.removeGame(updatedState.id);
          }

          break;
        }
        case "chat_message": {
          const game = manager.getGame(message.gameId);
          if (!game) {
            sendError(socket, "Game not found");
            break;
          }
          const player = game.players.find((p) => p.userId === userId);

          if (!chatLogs.has(message.gameId)) chatLogs.set(message.gameId, []);
          chatLogs.get(message.gameId)!.push({
            userId,
            username: player?.username ?? "",
            content: message.content,
            time: new Date().toISOString(),
          });

          broadCastToRoom(message.gameId, {
            type: "chat_message",
            userId,
            username: player?.username ?? "",
            content: message.content,
          });
          break;
        }
        case "create_room": {
          const user = await fastify.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true },
          });
          if (!user) {
            sendError(socket, "User not found");
            break;
          }
          const roomCode = roomManager.createRoom(
            userId,
            user.username,
            message.mode,
            message.maxPlayers,
            message.name,
            message.password,
          );
          if (!roomSockets.has(roomCode)) roomSockets.set(roomCode, new Set());
          roomSockets.get(roomCode)!.add({ socket, userId });
          socket.send(
            JSON.stringify({
              type: "room_updated",
              room: toRoomInfo(roomManager.getRoom(roomCode)!),
            }),
          );
          break;
        }
        case "join_room": {
          const user = await fastify.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true },
          });
          if (!user) {
            sendError(socket, "User not found");
            break;
          }

          const room = roomManager.getRoom(message.roomCode);
          if (!room) {
            sendError(socket, "Room not found");
            break;
          }

          const alreadyIn = room.players.some((p) => p.id === userId);

          if (!alreadyIn) {
            const result = roomManager.joinRoom(
              message.roomCode,
              userId,
              user.username,
              message.password,
            );
            if (!result.ok) {
              sendError(socket, result.error);
              break;
            }
          }

          if (!roomSockets.has(message.roomCode))
            roomSockets.set(message.roomCode, new Set());
          roomSockets.get(message.roomCode)!.add({ socket, userId });
          broadcastToRoomSockets(message.roomCode, {
            type: "room_updated",
            room: toRoomInfo(room),
          });
          break;
        }
        case "leave_room": {
          roomManager.leaveRoom(message.roomCode, userId);
          const roomSocketSet = roomSockets.get(message.roomCode);
          if (roomSocketSet) {
            for (const client of roomSocketSet) {
              if (client.userId === userId) {
                roomSocketSet.delete(client);
                break;
              }
            }
          }
          const room = roomManager.getRoom(message.roomCode);
          if (room) {
            broadcastToRoomSockets(message.roomCode, {
              type: "room_updated",
              room: toRoomInfo(room),
            });
          } else {
            roomSockets.delete(message.roomCode);
          }
          break;
        }
        case "update_room": {
          roomManager.updateSettings(
            message.roomCode,
            userId,
            message.settings,
          );
          const room = roomManager.getRoom(message.roomCode);
          if (!room) {
            sendError(socket, "Room not found");
            break;
          }
          broadcastToRoomSockets(message.roomCode, {
            type: "room_updated",
            room: toRoomInfo(room),
          });
          break;
        }
        case "start_game": {
          const room = roomManager.getRoom(message.roomCode);
          if (!room) {
            sendError(socket, "Room not found");
            break;
          }
          if (room.leaderId !== userId) {
            sendError(socket, "Only the leader can start");
            break;
          }
          if (room.players.length < 2) {
            sendError(socket, "Need at least 2 players");
            break;
          }
          const participants = room.players.map((p) => ({
            id: p.id,
            username: p.username,
          }));
          const gameId = fastify.gameManager.createGame(
            participants,
            room.mode,
            room.settings,
          );
          broadcastToRoomSockets(message.roomCode, {
            type: "game_started",
            gameId,
          } as ServerEvent);
          roomSockets.delete(message.roomCode);
          roomManager.removeRoom(message.roomCode);
          break;
        }
      }
    });

    socket.on("close", () => {
      // Clean up game sockets
      for (const [gameId, room] of rooms) {
        for (const client of room) {
          if (client.socket === socket) {
            room.delete(client);
            broadCastToRoom(gameId, { type: "player_left", userId });
            break;
          }
        }
      }

      // Clean up room sockets
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
    });

    socket.send(JSON.stringify({ type: "connected" }));
  });
}

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

function broadCastStateToRoom(gameId: string, state: InternalGameState): void {
  const room = rooms.get(gameId);
  if (!room) return;

  for (const client of room) {
    const playerGameState = filterStateForPlayer(state, client.userId);

    client.socket.send(
      JSON.stringify({ type: "game_updated", state: playerGameState }),
    );
  }
}

function sendError(socket: WebSocket, message: string): void {
  socket.send(JSON.stringify({ type: "error", message }));
}

function filterStateForPlayer(
  game: InternalGameState,
  userId: string,
): GameState {
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    settings: game.settings,
    players: game.players.map((p) => ({
      ...p,
      hand:
        p.userId === userId
          ? p.hand
          : p.hand.map(() => ({
              id: "",
              color: "wild" as CardColor,
              value: "wild" as CardValue,
            })),
    })),
    currentColor: game.currentColor,
    topCard: game.topCard,
    direction: game.direction,
    drawPileCount: game.drawPileCount,
    pendingDrawCount: game.pendingDrawCount,
    discardPile: game.discardPile,
    ranking: game.ranking,
    winnerId: game.winnerId,
  };
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

function toRoomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    name: room.name,
    hasPassword: !!room.password,
    leaderId: room.leaderId,
    maxPlayers: room.maxPlayers,
    players: room.players,
    mode: room.mode,
    settings: room.settings,
  };
}
