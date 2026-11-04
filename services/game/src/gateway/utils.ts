import { WebSocket } from "ws";
import {
  CardColor,
  CardValue,
  type ClientMessage,
  type GameState,
} from "shared";
import { InternalGameState } from "../engine/game-state.js";
import { Room } from "../managers/room.manager.js";
import type { RoomInfo } from "shared";

export function sendError(socket: WebSocket, message: string): void {
  socket.send(JSON.stringify({ type: "error", message }));
}

export function filterStateForPlayer(
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

export function toRoomInfo(room: Room): RoomInfo {
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

export function validateMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) return null;
  const msg = raw as Record<string, unknown>;

  switch (msg.type) {
    case "join_game":
    case "draw_card":
    case "chat_message":
      if (typeof msg.gameId !== "string") return null;
      if (msg.type === "chat_message" && typeof msg.content !== "string")
        return null;
      break;
    case "play_card":
      if (typeof msg.gameId !== "string" || typeof msg.cardId !== "string")
        return null;
      if (msg.chosenColor && typeof msg.chosenColor !== "string") return null;
      break;
    case "call_uno":
      break;
    case "catch_uno":
      if (
        typeof msg.gameId !== "string" ||
        typeof msg.targetUserId !== "string"
      )
        return null;
      break;
    case "challenge_bluff":
    case "accept_wild_draw4":
      if (typeof msg.gameId !== "string") return null;
      break;
    case "create_room":
      if (typeof msg.mode !== "string" || typeof msg.maxPlayers !== "number")
        return null;
      if (typeof msg.name !== "string") return null;
      break;
    case "join_room":
    case "leave_room":
    case "start_game":
      if (typeof msg.roomCode !== "string") return null;
      break;
    case "update_room":
      if (typeof msg.roomCode !== "string" || typeof msg.settings !== "object")
        return null;
      break;
    default:
      return null;
  }

  return msg as unknown as ClientMessage;
}
