import { useEffect, useState } from "react";

// Seconds left of a countdown of `seconds`, started at `startedAt` (a
// Date.now() value), or null when there is no countdown. Counts down to 0.
export function useCountdown(
  startedAt: number | null,
  seconds: number,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (startedAt === null) return null;
  const left = Math.ceil(seconds - (now - startedAt) / 1000);
  return Math.min(seconds, Math.max(0, left));
}
