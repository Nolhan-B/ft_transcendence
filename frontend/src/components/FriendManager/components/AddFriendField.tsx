import { useState, useEffect } from "react";
import type { Profile } from "shared";

export type AddFriendFieldProps = {
  // Called with the trimmed username when the form is submitted
  onAdd: (username: string) => void;
};

export function AddFriendField({ onAdd }: AddFriendFieldProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function removeErrorMessage() {
      if (username == "") {
        setError(null);
      }
    }

    removeErrorMessage();
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    setError(null);

    const trimmed = username.trim();
    if (trimmed === "") return;
    setLoading(true);

    try {
      // Get the user-id from the username
      const res = await fetch(
        `/api/user/users/by-username/${encodeURIComponent(trimmed)}`,
        { credentials: "include" },
      );
      if (res.status === 404) throw new Error("Player not found.");
      if (!res.ok) throw new Error("Failed to add this user.");
      const user = (await res.json()) as Profile;

      // Send friend request
      const request = await fetch(`/api/user/friends/request/${user.id}`, {
        method: "POST",
        credentials: "include",
      });
      if (!request.ok) throw new Error("Failed to send the request.");

      onAdd(trimmed);
      setUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label className="input input-sm flex w-full items-center gap-2 bg-base-300/60 focus-within:outline-2 focus-within:outline-base-content/20">
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 opacity-50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={username}
          placeholder="Search a username"
          aria-label="Player name"
          className="grow"
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>

      <button
        type="submit"
        className="btn btn-secondary btn-soft btn-sm w-full"
        disabled={loading || username.trim() === ""}
      >
        {loading ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Sending…
          </>
        ) : (
          "Add friend"
        )}
      </button>

      {error && (
        <div role="alert" className="alert alert-error alert-soft">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-4 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
