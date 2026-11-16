import { useCallback, useEffect, useState } from "react";
import type { RoomInfo } from "shared";

const REFRESH_MS = 5000;

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
      setRooms(await response.json());
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
