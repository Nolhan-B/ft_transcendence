import { useState } from "react";
import { Profile } from "shared";
import { ErrorAlert } from "../../ui/ErrorAlert";

export type AddFriendFieldProps = {
  // Called with the trimmed username when the form is submitted
  onAdd: (username: string) => void;
};

export function AddFriendField({ onAdd }: AddFriendFieldProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    setError(null);
    if (username === "") return ;
    setLoading(true);

    // Get the user-id from the username
    const res = await fetch(
      '/api/user/users/by-username/' + username,
      {credentials: "include" },
    );
    if (res.status === 404) setError("Player not found !");
    if (!res.ok) setError("Failed to add this user.")
    const user = (await res.json()) as Profile;

    // Send friend request
    await fetch(`/api/user/friends/request/${user.id}`, {
      method: "POST",
      credentials: "include",
    })

    const trimmed = username.trim();
    if (trimmed === "") return;

    onAdd(trimmed);
    setUsername("");
    setLoading(false);
  }

  return (
    <form className="flex flex-col flex-1 gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-1 gap-2">
        <input
          type="text"
          value={username}
          placeholder="Username"
          aria-label="Player name"
          className="flex flex-1 input input-sm"
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" className="btn btn-sm">
          {loading ? "Sending request..." : "Add friend"}
        </button>
      </div>

      {error ? 
      <div role="alert" className="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div> : ""}

    </form>
  );
}
