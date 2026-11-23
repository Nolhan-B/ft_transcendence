import { createContext } from "react";
import type {
  CardColor,
  CreateRoomPayload,
  GameSettings,
  GameState,
  RoomInfo,
} from "shared";
import type { Status } from "../hooks/ws/useWebSocket";

// Last UNO announced by the server: a player said UNO, or was caught
// without saying it (and drew 2 cards). "id" changes with every event.
export interface UnoEvent {
  id: number;
  kind: "called" | "caught";
  userId: string;
  // "caught": the player who caught them
  byUserId?: string;
}

export interface GameContextValue {
  status: Status;
  room: RoomInfo | null;
  gameId: string | null;
  // Last state of the game sent by the server (the other hands are hidden)
  gameState: GameState | null;
  // When the last state arrived: the server's turn timer restarts with it
  turnStartedAt: number | null;
  // Set when the server announces the end of the game
  winnerId: string | null;
  // When each player last said UNO (Date.now()), to know who is protected
  unoCalls: Record<string, number>;
  unoEvent: UnoEvent | null;
  // true while waiting for a ranked opponent
  inQueue: boolean;
  error: string | null;
  clearError: () => void;
  createRoom: (payload: CreateRoomPayload) => void;
  joinRoom: (roomCode: string, password?: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  // Leader only (the server ignores the others)
  updateSettings: (settings: GameSettings) => void;
  addBot: () => void;
  removeBot: (botId: string) => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  joinGame: (gameId: string) => void;
  playCard: (
    cardId: string,
    options?: { chosenColor?: CardColor; targetUserId?: string },
  ) => void;
  drawCard: () => void;
  callUno: () => void;
  catchUno: (targetUserId: string) => void;
  // Forget the finished game (back to the lobby)
  clearGame: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
