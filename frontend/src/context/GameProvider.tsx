import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CreateRoomPayload, RoomInfo, ServerEvent } from "shared";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { GameContext } from "./GameContext";
import type { GameContextValue } from "./GameContext";

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { status, send } = useWebSocket({
    path: "/api/game/ws",
    onMessage: (message) => {
      const event = message as ServerEvent;
      switch (event.type) {
        case "room_updated":
          setRoom(event.room);
          break;
        case "game_started":
          setGameId(event.gameId);
          break;
        case "error":
          setError(event.message);
          break;
      }
    },
  });

  const createRoom = useCallback(
    (payload: CreateRoomPayload) => {
      setError(null);
      send({ type: "create_room", ...payload });
    },
    [send],
  );

  const joinRoom = useCallback(
    (roomCode: string, password?: string) => {
      setError(null);
      send({ type: "join_room", roomCode, password });
    },
    [send],
  );

  const leaveRoom = useCallback(() => {
    if (!room) return;
    send({ type: "leave_room", roomCode: room.code });
    setRoom(null);
  }, [send, room]);

  const startGame = useCallback(() => {
    if (!room) return;
    send({ type: "start_game", roomCode: room.code });
  }, [send, room]);

  const value = useMemo<GameContextValue>(
    () => ({
      status,
      room,
      gameId,
      error,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
    }),
    [status, room, gameId, error, createRoom, joinRoom, leaveRoom, startGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
