import { useState } from "react";

export type AddFriendFieldProps = {
  // Called with the trimmed username when the form is submitted
  onAdd: (username: string) => void;
};

export function AddFriendField({ onAdd }: AddFriendFieldProps) {
  const [username, setUsername] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading

    const trimmed = username.trim();
    if (trimmed === "") return;

    onAdd(trimmed);
    setUsername("");
  }

  return (
    <form className="flex gap-2 items-center" onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        placeholder="Player name"
        aria-label="Player name"
        className="flex flex-1 input input-sm"
        onChange={(e) => setUsername(e.target.value)}
      />
      <button type="submit" className="btn btn-sm">
        Add friend
      </button>
    </form>
  );
}
