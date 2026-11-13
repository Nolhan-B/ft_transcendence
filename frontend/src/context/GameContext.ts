import { createContext } from "react";
import type { CreateRoomPayload, RoomInfo } from "shared";
import type { Status } from "../hooks/ws/useWebSocket";

export interface GameContextValue {
  status: Status;
  room: RoomInfo | null;
  gameId: string | null;
  error: string | null;
  createRoom: (payload: CreateRoomPayload) => void;
  joinRoom: (roomCode: string, password?: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);
