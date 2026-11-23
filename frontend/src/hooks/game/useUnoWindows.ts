import { useEffect, useRef, useState } from "react";
import type { GameState } from "shared";

// How long the server waits after a player is down to one card (play-card.ts).
// During that time the player can say UNO, or be caught by another player.
const UNO_WINDOW_MS = 5000;

// The players who are down to one card and have not said UNO yet, while the
// server still accepts it. The server does not send these windows: they are
// opened here when a hand goes from 2+ cards to 1 card.
//   stateAt: when the current state arrived (Date.now())
//   unoCalls: when each player last said UNO (Date.now())
export function useUnoWindows(
  state: GameState,
  stateAt: number | null,
  unoCalls: Record<string, number>,
): string[] {
  const previous = useRef<Record<string, number>>({});
  // Start of each open window, by player
  const [windows, setWindows] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const counts = Object.fromEntries(
      state.players.map((player) => [player.userId, player.hand.length]),
    );
    const before = previous.current;
    previous.current = counts;
    if (!state.settings.unoCallout) return;

    setWindows((open) => {
      const next: Record<string, number> = {};
      // A window stays open only while the player still has one card
      for (const [id, start] of Object.entries(open))
        if (counts[id] === 1) next[id] = start;
      for (const [id, count] of Object.entries(counts))
        if (count === 1 && (before[id] ?? 0) >= 2)
          next[id] = stateAt ?? Date.now();
      return next;
    });
  }, [state, stateAt]);

  // Render again when the next window closes
  useEffect(() => {
    const ends = Object.values(windows)
      .map((start) => start + UNO_WINDOW_MS)
      .filter((end) => end > now);
    if (ends.length === 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(...ends) - Date.now() + 50,
    );
    return () => clearTimeout(timer);
  }, [windows, now]);

  return Object.entries(windows)
    .filter(
      ([id, start]) =>
        Math.max(now, start) < start + UNO_WINDOW_MS &&
        (unoCalls[id] ?? 0) < start,
    )
    .map(([id]) => id);
}
