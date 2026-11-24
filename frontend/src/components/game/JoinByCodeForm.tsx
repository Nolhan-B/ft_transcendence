import { useState } from "react";
import type { FormEvent } from "react";
import { useGame } from "../../hooks/ws/useGame";

// Room codes: 6 characters, without the look-alikes I, O, 0 and 1
// (generateRoomCode in the game service)
const CODE_LENGTH = 6;
const NOT_IN_CODE = /[^A-HJ-NP-Z2-9]/g;

// Join a room from the code a friend gave (private rooms ask for the
// password), as a banner of the lobby. The server errors (unknown
// room, full, wrong password) show as toasts.
export function JoinByCodeForm() {
  const { joinRoom, status } = useGame();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    joinRoom(code, password || undefined);
  }

  return (
    <form
      onSubmit={submit}
      className="panel-glass flex flex-wrap items-center gap-4 rounded-box border p-4 sm:p-5"
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl text-secondary-content">
        🔑
      </div>
      <div className="min-w-48 flex-1">
        <h2 className="text-lg font-bold">Join with a code</h2>
        <p className="text-sm text-white/70">
          A friend gave you a room code? Private rooms also ask for the
          password.
        </p>
      </div>

      <div className="join">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Room code"
          placeholder="ROOM CODE"
          className="input join-item w-36 font-semibold tracking-[0.2em] uppercase placeholder:tracking-normal"
          required
          minLength={CODE_LENGTH}
          maxLength={CODE_LENGTH}
          value={code}
          // Upper case, without the characters a code never has
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(NOT_IN_CODE, ""))
          }
        />
        <input
          type="password"
          aria-label="Room password (private rooms only)"
          placeholder="password"
          className="input join-item w-32"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="submit"
          className="btn btn-secondary join-item"
          disabled={status !== "open" || code.length !== CODE_LENGTH}
        >
          Join
        </button>
      </div>
    </form>
  );
}
