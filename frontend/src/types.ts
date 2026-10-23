export type CardColor = "red" | "yellow" | "green" | "blue" | "wild";
export type PlayColor = Exclude<CardColor, "wild">;

export interface Card {
  id: string;
  color: CardColor;
  value: string;
}

export interface Player {
  userId: string;
  username: string;
  hand: Card[];
  isCurrentTurn: boolean;
  disconnected?: boolean;
}

export type StackingRule = "none" | "same" | "all";

export interface GameSettings {
  stacking: StackingRule;
  sevenZeroRule: boolean;
  jumpIn: boolean;
  bluffChallenge: boolean;
  unoCallout: boolean;
}

export type GameMode = "classic" | "ranked";

export interface GameState {
  id: string;
  mode: GameMode;
  status: "waiting" | "in_progress" | "finished";
  settings: GameSettings;
  players: Player[];
  currentColor: CardColor;
  topCard: Card;
  direction: 1 | -1;
  drawPileCount: number;
  pendingDrawCount: number;
  discardPile: Card[];
  ranking: string[];
  winnerId?: string | null;
}

export interface RoomInfo {
  code: string;
  name: string;
  hasPassword: boolean;
  leaderId: string;
  maxPlayers: number;
  players: { id: string; username: string }[];
  mode: GameMode;
  settings: GameSettings;
}

export interface User {
  id: string;
  username: string;
  email?: string;
}

export type ServerMessage =
  | { type: "connected" }
  | { type: "room_updated"; room: RoomInfo }
  | { type: "game_started"; gameId: string }
  | { type: "game_updated"; state: GameState }
  | { type: "player_joined"; userId: string }
  | { type: "player_left"; userId: string }
  | { type: "game_ended"; winnerId: string }
  | { type: "chat_message"; userId: string; username: string; content: string }
  | { type: "uno_caught"; targetUserId: string; catcherUserId: string }
  | {
      type: "bluff_result";
      challengerUserId: string;
      targetUserId: string;
      wasBluff: boolean;
      penaltyCount: number;
    }
  | { type: "error"; message: string };

export type ToastKind = "info" | "success" | "warn" | "error";
export type ToastFn = (text: string, kind?: ToastKind) => void;
