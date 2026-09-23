import type { CardColor, GameState } from './game.js';

// Client -> Server
export interface JoinGamePayload {
  gameId: string;
}

export interface PlayCardPayload {
  gameId: string;
  cardId: string;
  chosenColor?: CardColor; // requis pour wild / wild_draw4
}

export interface DrawCardPayload {
  gameId: string;
}

// Server -> Client
export interface GameUpdatedEvent {
  type: 'game_updated';
  state: GameState;
}

export interface PlayerJoinedEvent {
  type: 'player_joined';
  userId: string;
}

export interface PlayerLeftEvent {
  type: 'player_left';
  userId: string;
}

export interface GameEndedEvent {
  type: 'game_ended';
  winnerId: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ServerEvent =
  | GameUpdatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | GameEndedEvent
  | ErrorEvent;
