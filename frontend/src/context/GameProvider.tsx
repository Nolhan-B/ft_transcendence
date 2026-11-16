import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CreateRoomPayload, RoomInfo, ServerEvent } from "shared";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { GameContext } from "./GameContext";
import type { GameContextValue } from "./GameContext";

// The server closes the socket after these refusals. "Already connected" is
// often only a race (page reload, hot reload: the old socket is not closed yet
// on the server), so it is retried a few times before giving up.
const ALWAYS_FATAL = ["Unauthorized", "Invalid token"];
const MAX_REFUSALS = 3;

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consecutive "Already connected" answers (reset once the server accepts us)
  const refusals = useRef(0);

  const { status, send } = useWebSocket({
    path: "/api/game/ws",
    isFatal: (message) => {
      const event = message as ServerEvent;
      return (
        event.type === "error" &&
        (ALWAYS_FATAL.includes(event.message) ||
          (event.message === "Already connected" &&
            refusals.current >= MAX_REFUSALS))
      );
    },
    onMessage: (message) => {
      // Not part of ServerEvent: sent by the server once it accepts the socket
      if ((message as { type?: string }).type === "connected") {
        refusals.current = 0;
        return;
      }
      const event = message as ServerEvent;
      switch (event.type) {
        case "room_updated":
          setRoom(event.room);
          break;
        case "game_started":
          setGameId(event.gameId);
          break;
        case "error":
          if (event.message === "Already connected") {
            refusals.current++;
            // Still retrying: stay silent
            if (refusals.current < MAX_REFUSALS) break;
            setError(
              "The game is already open in another tab or window. Close it, then reload this page.",
            );
            break;
          }
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

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<GameContextValue>(
    () => ({
      status,
      room,
      gameId,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
    }),
    [
      status,
      room,
      gameId,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
