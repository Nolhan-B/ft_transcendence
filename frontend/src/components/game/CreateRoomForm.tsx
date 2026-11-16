import { useState } from "react";
import type { FormEvent } from "react";
import type { GameMode } from "shared";
import { useGame } from "../../hooks/ws/useGame";

const SIZES = [2, 3, 4];

// A ranked game only starts through the matchmaking: rooms are classic
const CLASSIC = "classic" as GameMode;

export function CreateRoomForm() {
  const { createRoom, status } = useGame();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [password, setPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    createRoom({
      name: name.trim(),
      mode: CLASSIC,
      maxPlayers,
      password: password === "" ? undefined : password,
    });
  }

  return (
    <form onSubmit={submit} className="card bg-base-200 shadow-xl">
      <div className="card-body gap-2">
        <h2 className="card-title">Create a room</h2>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Name</legend>
          <input
            type="text"
            className="input validator w-full"
            required
            minLength={1}
            maxLength={30}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="validator-hint">1 to 30 characters</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Players</legend>
          <div className="join">
            {SIZES.map((size) => (
              <input
                key={size}
                type="radio"
                name="max-players"
                aria-label={String(size)}
                className="btn join-item"
                checked={maxPlayers === size}
                onChange={() => setMaxPlayers(size)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Password (optional)</legend>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </fieldset>

        <div className="card-actions justify-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status !== "open"}
          >
            Create
          </button>
        </div>
      </div>
    </form>
  );
}
