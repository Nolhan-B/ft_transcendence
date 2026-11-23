import { useState } from "react";
import type { FormEvent } from "react";
import { useGame } from "../../hooks/ws/useGame";

// Room codes: 6 characters, without the look-alikes I, O, 0 and 1
// (generateRoomCode in the game service)
const CODE_LENGTH = 6;
const NOT_IN_CODE = /[^A-HJ-NP-Z2-9]/g;

// Join a room from the code a friend gave (private rooms ask for the password).
// The server errors (unknown room, full, wrong password) show as toasts.
export function JoinByCodeForm() {
  const { joinRoom, status } = useGame();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    joinRoom(code, password || undefined);
  }

  return (
    <form onSubmit={submit} className="card bg-base-200 shadow-xl">
      <div className="card-body gap-2">
        <h2 className="card-title">Join with a code</h2>
        <p className="text-sm opacity-70">
          Enter the room code a friend gave you.
        </p>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Room code</legend>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
            placeholder="AB2CD3"
            className="input input-lg validator w-full text-center font-mono text-2xl font-black uppercase tracking-[0.4em] text-secondary placeholder:tracking-[0.4em]"
            required
            minLength={CODE_LENGTH}
            maxLength={CODE_LENGTH}
            value={code}
            // Upper case, without the characters a code never has
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(NOT_IN_CODE, ""))
            }
          />
          <p className="validator-hint">The code has 6 characters</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            Password (private rooms only)
          </legend>
          <input
            type="password"
            aria-label="Room password"
            className="input w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </fieldset>

        <div className="card-actions justify-end">
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={status !== "open" || code.length !== CODE_LENGTH}
          >
            Join
          </button>
        </div>
      </div>
    </form>
  );
}
