import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { RoomInfo } from "shared";
import { useGame } from "../../hooks/ws/useGame";
import { useRooms } from "../../hooks/game/useRooms";

function RoomRow({ room }: { room: RoomInfo }) {
  const { joinRoom, status } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");

  const full = room.players.length >= room.maxPlayers;

  function join() {
    if (room.hasPassword) {
      setPassword("");
      dialog.current?.showModal();
    } else {
      joinRoom(room.code);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    joinRoom(room.code, password);
    dialog.current?.close();
  }

  return (
    <li className="list-row items-center">
      <div className="list-col-grow">
        <div className="flex items-center gap-2 font-semibold">
          {room.name}
          {room.hasPassword && (
            <span className="badge badge-ghost badge-sm">Private</span>
          )}
        </div>
        <div className="text-xs opacity-60">
          {room.players[0]?.username ?? "-"} · {room.mode}
        </div>
      </div>
      <span className="badge badge-outline">
        {room.players.length} / {room.maxPlayers}
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={full || status !== "open"}
        onClick={join}
      >
        {full ? "Full" : "Join"}
      </button>

      <dialog ref={dialog} className="modal">
        <form onSubmit={submit} className="modal-box">
          <h3 className="text-lg font-bold">{room.name}</h3>
          <fieldset className="fieldset mt-4">
            <legend className="fieldset-legend">Password</legend>
            <input
              type="password"
              className="input w-full"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </fieldset>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Join
            </button>
          </div>
        </form>
        <div
          className="modal-backdrop"
          onClick={() => dialog.current?.close()}
        />
      </dialog>
    </li>
  );
}

export function RoomList() {
  const { rooms, loading, error, refresh } = useRooms();

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">Open rooms</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={refresh}
          >
            Refresh
          </button>
        </div>

        {loading && <div className="skeleton h-24 w-full" />}
        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        {rooms && rooms.length === 0 && (
          <p className="py-6 text-center opacity-70">
            No room yet. Create the first one!
          </p>
        )}
        {rooms && rooms.length > 0 && (
          <ul className="list">
            {rooms.map((room) => (
              <RoomRow key={room.code} room={room} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
