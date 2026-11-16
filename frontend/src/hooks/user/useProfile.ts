import { useEffect, useState } from "react";
import type { Profile } from "shared";

interface Result {
  id: string;
  profile: Profile | null;
  error: string | null;
}

// Public profile of a user (no cookie needed on the server side)
export function useProfile(id: string | undefined) {
  const [result, setResult] = useState<Result | null>(null);
  // Bumped by reload() to fetch the profile again (after an edit)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;

    fetch(`/api/user/profile/${id}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 404) throw new Error("User not found.");
        if (!response.ok) throw new Error("Unable to load the profile.");
        const data: { profile: Profile } = await response.json();
        return { id, profile: data.profile, error: null };
      })
      .catch((err: Error) => ({
        id,
        profile: null,
        error: err.message || "Unable to load the profile.",
      }))
      .then((next) => {
        if (active) setResult(next);
      });

    return () => {
      active = false;
    };
  }, [id, version]);

  // No answer yet for the current id: still loading
  const loading = !!id && result?.id !== id;
  return {
    profile: loading ? null : (result?.profile ?? null),
    error: loading ? null : (result?.error ?? null),
    loading,
    reload: () => setVersion((value) => value + 1),
  };
}
