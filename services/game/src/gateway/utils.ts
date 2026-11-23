import { WebSocket } from "ws";
import {
  CardColor,
  CardValue,
  GameMode,
  type ClientMessage,
  type GameSettings,
  type GameState,
  type StackingRule,
} from "shared";
import { InternalGameState, LiveStateFields } from "../engine/game-state.js";
import { Room } from "../managers/room.manager.js";
import type { RoomInfo } from "shared";

// Bornes d'une partie : au-dela de 15 joueurs le paquet (108 cartes) ne suffit
// plus a distribuer 7 cartes chacun, et createGame plante
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const ROOM_NAME_MAX_LENGTH = 50;

const STACKING_RULES: StackingRule[] = ["none", "same", "all"];
const BOOLEAN_SETTINGS = [
  "sevenZeroRule",
  "jumpIn",
  "bluffChallenge",
  "unoCallout",
] as const;

// Settings incomplets ou faux = regles cassees (ex : stacking absent, un +2
// pouvait etre ignore). On exige l'objet complet, avec les bons types
export function isValidSettings(raw: unknown): raw is GameSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return false;
  const s = raw as Record<string, unknown>;
  if (!STACKING_RULES.includes(s.stacking as StackingRule)) return false;
  return BOOLEAN_SETTINGS.every((key) => typeof s[key] === "boolean");
}

// Copie limitee aux champs connus : les cles en trop ne sont pas stockees
export function pickSettings(s: GameSettings): GameSettings {
  return {
    stacking: s.stacking,
    sevenZeroRule: s.sevenZeroRule,
    jumpIn: s.jumpIn,
    bluffChallenge: s.bluffChallenge,
    unoCallout: s.unoCallout,
  };
}

// Cle des fenetres UNO : par partie ET par joueur (un userId seul pouvait
// melanger deux parties, ex : fenetre pas encore expiree d'une partie finie)
export function unoKey(gameId: string, userId: string): string {
  return `${gameId}:${userId}`;
}

export function sendError(socket: WebSocket, message: string): void {
  socket.send(JSON.stringify({ type: "error", message }));
}

// Champs calcules au moment de l'envoi par le gateway (chronos, sockets)
export type LiveState = Pick<GameState, LiveStateFields>;

export const NO_LIVE_STATE: LiveState = {
  turnTimeLeftMs: null,
  pendingWildDraw4: null,
  unoVulnerable: [],
  reconnecting: [],
};

export function filterStateForPlayer(
  game: InternalGameState,
  userId: string,
  live: LiveState = NO_LIVE_STATE,
): GameState {
  return {
    ...live,
    // Les cartes piochees ne sont visibles que par celui qui les pioche
    lastActions: game.lastActions.map((action) =>
      action.type === "cards_drawn" && action.userId !== userId
        ? { ...action, cards: undefined }
        : action,
    ),
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

export function filterStateForSpectator(
  game: InternalGameState,
  live: LiveState = NO_LIVE_STATE,
): GameState {
  return filterStateForPlayer(game, "", live);
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
    case "catch_uno":
      if (
        typeof msg.gameId !== "string" ||
        typeof msg.targetUserId !== "string"
      )
        return null;
      break;
    case "challenge_bluff":
    case "accept_wild_draw4":
    case "call_uno":
      if (typeof msg.gameId !== "string") return null;
      break;
    case "create_room": {
      if (!Object.values(GameMode).includes(msg.mode as GameMode)) return null;
      const maxPlayers = msg.maxPlayers;
      if (
        typeof maxPlayers !== "number" ||
        !Number.isInteger(maxPlayers) ||
        maxPlayers < MIN_PLAYERS ||
        maxPlayers > MAX_PLAYERS
      )
        return null;
      if (typeof msg.name !== "string") return null;
      const name = msg.name.trim();
      if (name.length === 0 || name.length > ROOM_NAME_MAX_LENGTH) return null;
      if (msg.password !== undefined && typeof msg.password !== "string")
        return null;
      break;
    }
    case "join_room":
      if (typeof msg.roomCode !== "string") return null;
      if (msg.password !== undefined && typeof msg.password !== "string")
        return null;
      break;
    case "leave_room":
    case "start_game":
      if (typeof msg.roomCode !== "string") return null;
      break;
    case "update_room":
      if (typeof msg.roomCode !== "string" || !isValidSettings(msg.settings))
        return null;
      break;
    case "add_bot":
      if (typeof msg.roomCode !== "string") return null;
      break;
    case "remove_bot":
      if (typeof msg.roomCode !== "string" || typeof msg.botId !== "string")
        return null;
      break;
    case "spectate_game":
    case "leave_spectate":
      if (typeof msg.gameId !== "string") return null;
      break;
    case "join_queue":
    case "leave_queue":
      break;
    default:
      return null;
  }

  return msg as unknown as ClientMessage;
}
