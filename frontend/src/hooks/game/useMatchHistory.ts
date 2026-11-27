import { useEffect, useState } from "react";
import type { Match } from "shared";

interface Result {
  matches: Match[];
  error: string | null;
}

// Finished games of a player, newest first: mine when isOwn, otherwise
// the ones of userId (a friend's profile...)
export function useMatchHistory(userId: string | undefined, isOwn: boolean) {
  const enabled = userId !== undefined;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let active = true;
    setResult(null);

    const url = isOwn
      ? "/api/game/games/history"
      : `/api/game/games/history/${encodeURIComponent(userId)}`;
    fetch(url, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the game history.");
        const matches: Match[] = await response.json();
        return { matches, error: null };
      })
      .catch((err: Error) => ({
        matches: [],
        error: err.message || "Unable to load the game history.",
      }))
      .then((next) => {
        if (active) setResult(next);
      });

    return () => {
      active = false;
    };
  }, [userId, isOwn]);

  return {
    matches: result?.matches ?? [],
    error: result?.error ?? null,
    loading: enabled && result === null,
  };
}
