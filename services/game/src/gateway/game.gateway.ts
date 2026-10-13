import { FastifyInstance } from "fastify";
import { WebSocket } from "@fastify/websocket";
import {
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

    socket.on("message", (data: RawData) => {
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
          broadCastStateToRoom(game.id, updatedState);

          if (updatedState.status === GameStatus.FINISHED) {
            broadCastToRoom(game.id, {
              type: "game_ended",
              winnerId: updatedState.winnerId!,
            });
            // TODO : Faire persister la game en bdd et agir sur les rank pour ranked
            rooms.delete(updatedState.id);
            manager.removeGame(updatedState.id);
          }
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
          broadCastStateToRoom(game.id, updatedState);

          if (updatedState.status === GameStatus.FINISHED) {
            broadCastToRoom(game.id, {
              type: "game_ended",
              winnerId: updatedState.winnerId!,
            });
            // TODO : Faire persister la game en bdd et agir sur les rank pour ranked
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
    // envoie un message au client
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
              color: "wild" as any,
              value: "wild" as any,
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
