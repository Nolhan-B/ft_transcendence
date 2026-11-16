import { createContext } from "react";
import type { CreateRoomPayload, GameSettings, RoomInfo } from "shared";
import type { Status } from "../hooks/ws/useWebSocket";

export interface GameContextValue {
  status: Status;
  room: RoomInfo | null;
  gameId: string | null;
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
}

export const GameContext = createContext<GameContextValue | null>(null);
