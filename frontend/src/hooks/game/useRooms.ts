import { useCallback, useEffect, useState } from "react";
import type { RoomInfo } from "shared";

const REFRESH_MS = 5000;

// Only the well-formed rooms: one broken entry must not blank the lobby
function isRoom(value: unknown): value is RoomInfo {
  const room = value as RoomInfo;
  return (
    typeof room?.code === "string" &&
    typeof room.name === "string" &&
    Array.isArray(room.players) &&
    room.players.every(
      (p) => typeof p?.id === "string" && typeof p?.username === "string",
    )
  );
}

// Open rooms. The server does not push the list: it is asked again every few
// seconds, and on demand with refresh().
export function useRooms() {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/game/games/rooms", {
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      setRooms(Array.isArray(data) ? data.filter(isRoom) : []);
      setError(null);
    } catch {
      setError("Unable to load the rooms.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { rooms, loading: rooms === null && error === null, error, refresh };
}
