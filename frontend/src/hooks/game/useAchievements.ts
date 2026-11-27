import { useEffect, useState } from "react";
import type { Achievement } from "shared";

// Achievements of a player, computed by the server from his history
export function useAchievements(userId: string | undefined) {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let active = true;
    setAchievements(null);
    setError(null);
    fetch(`/api/game/games/achievements/${encodeURIComponent(userId)}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { achievements: Achievement[] };
        if (active) setAchievements(data.achievements);
      })
      .catch(() => {
        if (active) setError("Unable to load the achievements.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { achievements, error, loading: achievements === null && !error };
}
