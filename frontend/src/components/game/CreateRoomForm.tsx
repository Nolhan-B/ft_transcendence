import { useState } from "react";
import type { FormEvent } from "react";
import type { GameMode } from "shared";
import { useGame } from "../../hooks/ws/useGame";

const SIZES = [2, 3, 4];

// A ranked game only starts through the matchmaking: rooms are classic
const CLASSIC = "classic" as GameMode;

interface Props {
  open: boolean;
  onClose: () => void;
}

// Pop-up to open a new room. Once the server created it, the lobby moves to
// the room page by itself.
export function CreateRoomForm({ open, onClose }: Props) {
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
    <dialog className={`modal ${open ? "modal-open" : ""}`}>
      <form onSubmit={submit} className="modal-box animate-pop">
        <h3 className="text-display text-2xl">New room</h3>

        <fieldset className="fieldset mt-4">
          <legend className="fieldset-legend">Room name</legend>
          <input
            type="text"
            className="input validator w-full"
            placeholder="Friday night"
            required
            maxLength={30}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="validator-hint">1 to 30 characters</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Players</legend>
          {/* Segmented choice: the selected size is yellow */}
          <div className="flex gap-1 rounded-field bg-black/35 p-1">
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={maxPlayers === size}
                className={`flex-1 cursor-pointer rounded-[calc(var(--radius-field)-4px)] py-2 font-semibold transition-colors ${
                  maxPlayers === size
                    ? "bg-accent text-accent-content"
                    : "text-white/65 hover:text-white"
                }`}
                onClick={() => setMaxPlayers(size)}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="label">
            Classic mode: the first to empty their hand wins.
          </p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            Password <span className="font-normal opacity-60">(optional)</span>
          </legend>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </fieldset>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-accent"
            disabled={status !== "open"}
          >
            Open the table
          </button>
        </div>
      </form>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
