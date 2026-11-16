import { useEffect, useState } from "react";
import type { Match } from "shared";

interface Result {
  matches: Match[];
  error: string | null;
}

// Finished games of the connected user, newest first. The server only
// answers for the user of the cookie: there is no history of another player.
export function useMatchHistory(enabled: boolean) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    fetch("/api/game/games/history", { credentials: "include" })
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
  }, [enabled]);

  return {
    matches: result?.matches ?? [],
    error: result?.error ?? null,
    loading: enabled && result === null,
  };
}
