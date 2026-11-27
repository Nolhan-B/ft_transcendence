import { useCallback, useEffect, useState } from "react";
import type { Profile } from "shared";
import { useChat } from "../ws/useChat";

// The users I blocked, and the actions to block / unblock someone. A blocked
// user cannot message me or send me a friend request (nor I them), and our
// friendship ends.
export function useBlocks() {
  const { forgetUser } = useChat();
  const [blocked, setBlocked] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/user/blocks", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the blocked users.");
        const data: { blocked: Profile[] } = await response.json();
        if (active) setBlocked(data.blocked);
      })
      .catch((err: Error) => {
        if (active) {
          setBlocked([]);
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const block = useCallback(
    async (user: Profile) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/user/blocks/${user.id}`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to block this user.");
        setBlocked((all) => [
          user,
          ...(all ?? []).filter((b) => b.id !== user.id),
        ]);
        // Gone from my friends, requests and chats right away
        forgetUser(user.id);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [forgetUser],
  );

  const unblock = useCallback(async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/user/blocks/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      // 404: it was not blocked anymore, same result
      if (!response.ok && response.status !== 404)
        throw new Error("Unable to unblock this user.");
      setBlocked((all) => (all ?? []).filter((b) => b.id !== userId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    blocked: blocked ?? [],
    loading: blocked === null,
    error,
    busy,
    block,
    unblock,
    isBlocked: (userId: string) => (blocked ?? []).some((b) => b.id === userId),
  };
}
