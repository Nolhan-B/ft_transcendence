import type { CardColor, GameState } from "./game.js";

// Client -> Server
export interface JoinGamePayload {
  gameId: string;
}

export interface PlayCardPayload {
  gameId: string;
  cardId: string;
  chosenColor?: CardColor; // requis pour wild / wild_draw4
  targetUserId?: string;
}

export interface DrawCardPayload {
  gameId: string;
}

export interface ChatMessagePayload {
  gameId: string;
  content: string;
}

export interface CallUnoPayload {
  gameId: string;
}

export interface CatchUnoPayload {
  gameId: string;
  targetUserId: string;
}

// Server -> Client
export interface GameUpdatedEvent {
  type: "game_updated";
  state: GameState;
}

export interface PlayerJoinedEvent {
  type: "player_joined";
  userId: string;
}

export interface PlayerLeftEvent {
  type: "player_left";
  userId: string;
}

export interface GameEndedEvent {
  type: "game_ended";
  winnerId: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface ChatMessageEvent {
  type: "chat_message";
  userId: string;
  username: string;
  content: string;
}

export interface UnoCaughtEvent {
  type: "uno_caught";
  targetUserId: string;
  catcherUserId: string;
}

export type ServerEvent =
  | GameUpdatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | GameEndedEvent
  | ChatMessageEvent
  | ErrorEvent
  | UnoCaughtEvent;

export type ClientMessage =
  | ({ type: "join_game" } & JoinGamePayload)
  | ({ type: "play_card" } & PlayCardPayload)
  | ({ type: "draw_card" } & DrawCardPayload)
  | ({ type: "chat_message" } & ChatMessagePayload)
  | ({ type: "call_uno" } & CallUnoPayload)
  | ({ type: "catch_uno" } & CatchUnoPayload);
