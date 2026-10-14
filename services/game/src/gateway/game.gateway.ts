import { FastifyInstance } from "fastify";
import { WebSocket } from "@fastify/websocket";
import {
  CardColor,
  CardValue,
  GameStatus,
  type ClientMessage,
  type GameState,
  type ServerEvent,
} from "shared";
import { RawData } from "ws";
import { InternalGameState } from "../engine/game-state.js";

const rooms: Map<
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

export default async function gameGateway(fastify: FastifyInstance) {
  const manager = fastify.gameManager;

  fastify.get("/ws", { websocket: true }, async (socket, request) => {
    try {
      await request.jwtVerify();
    } catch {
      sendError(socket, "Unauthorized");
      socket.close();
      return;
    }

    const { id: userId } = request.user as { id: string };

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

          if (updatedState.status === GameStatus.FINISHED) {
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

          if (updatedState.status === GameStatus.FINISHED) {
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
      }
    });

    socket.on("close", () => {
      for (const [gameId, room] of rooms) {
        for (const client of room) {
          if (client.socket === socket) {
            room.delete(client);
            broadCastToRoom(gameId, { type: "player_left", userId });
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
    discardPile: game.discardPile,
    ranking: game.ranking,
    winnerId: game.winnerId,
  };
}
