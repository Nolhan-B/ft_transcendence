import type { CardColor, GameState, GameMode, GameSettings } from "./game.js";

// ============================================================
// ROOM - Client -> Server
// ============================================================

export interface CreateRoomPayload {
  mode: GameMode;
  maxPlayers: number;
}

export interface JoinRoomPayload {
  roomCode: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
}

export interface UpdateRoomPayload {
  roomCode: string;
  settings: GameSettings;
}

export interface StartGamePayload {
  roomCode: string;
}

// ============================================================
// GAME - Client -> Server
// ============================================================

export interface JoinGamePayload {
  gameId: string;
}

export interface PlayCardPayload {
  gameId: string;
  cardId: string;
  chosenColor?: CardColor;
  targetUserId?: string;
}

export interface ChallengeBluffPayload {
  gameId: string;
}

export interface AcceptWildDraw4Payload {
  gameId: string;
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

// ============================================================
// ROOM - Server -> Client
// ============================================================

export interface RoomInfo {
  code: string;
  leaderId: string;
  maxPlayers: number;
  players: { id: string; username: string }[];
  mode: GameMode;
  settings: GameSettings;
}

export interface RoomUpdatedEvent {
  type: "room_updated";
  room: RoomInfo;
}

export interface GameStartedEvent {
  type: "game_started";
  gameId: string;
}

// ============================================================
// GAME - Server -> Client
// ============================================================

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

export interface BluffResultEvent {
  type: "bluff_result";
  challengerUserId: string;
  targetUserId: string;
  wasBluff: boolean;
  penaltyCount: number;
}

// ============================================================
// UNIONS
// ============================================================

export type ServerEvent =
  | RoomUpdatedEvent
  | GameStartedEvent
  | GameUpdatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | GameEndedEvent
  | ChatMessageEvent
  | ErrorEvent
  | UnoCaughtEvent
  | BluffResultEvent;

export type ClientMessage =
  | ({ type: "create_room" } & CreateRoomPayload)
  | ({ type: "join_room" } & JoinRoomPayload)
  | ({ type: "leave_room" } & LeaveRoomPayload)
  | ({ type: "update_room" } & UpdateRoomPayload)
  | ({ type: "start_game" } & StartGamePayload)
  | ({ type: "join_game" } & JoinGamePayload)
  | ({ type: "play_card" } & PlayCardPayload)
  | ({ type: "draw_card" } & DrawCardPayload)
  | ({ type: "chat_message" } & ChatMessagePayload)
  | ({ type: "call_uno" } & CallUnoPayload)
  | ({ type: "catch_uno" } & CatchUnoPayload)
  | ({ type: "challenge_bluff" } & ChallengeBluffPayload)
  | ({ type: "accept_wild_draw4" } & AcceptWildDraw4Payload);