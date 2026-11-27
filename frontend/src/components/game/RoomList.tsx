import { useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { GameSettings, RoomInfo } from "shared";
import { useGame } from "../../hooks/ws/useGame";

// Short names of the house rules turned on in a room
function activeRules(settings: GameSettings): string[] {
  const rules: string[] = [];
  if (settings.stacking !== "none")
    rules.push(settings.stacking === "all" ? "Stack all" : "Stack same");
  if (settings.sevenZeroRule) rules.push("7-0");
  if (settings.jumpIn) rules.push("Jump-in");
  if (settings.bluffChallenge) rules.push("Bluff");
  if (settings.unoCallout) rules.push("Catch UNO");
  return rules;
}

// One open room, as a card of the grid
function RoomCard({ room, index }: { room: RoomInfo; index: number }) {
  const { joinRoom, status } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");

  const full = room.players.length >= room.maxPlayers;
  const rules = activeRules(room.settings);
  const host = room.players.find((player) => player.id === room.leaderId);

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
    <li
      className="panel-glass animate-pop flex flex-col gap-3 rounded-box border p-5 transition-transform duration-200 hover:-translate-y-1 hover:-rotate-[0.5deg]"
      style={{ animationDelay: `${index * 40}ms` } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-lg font-bold">{room.name}</h3>
        {room.hasPassword && (
          <span title="Password protected" aria-label="Private room">
            🔒
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span
          className={`badge border-0 font-semibold uppercase ${
            room.mode === "ranked"
              ? "bg-accent text-accent-content"
              : "bg-secondary text-secondary-content"
          }`}
        >
          {room.mode}
        </span>
        <span className="font-semibold tracking-wider text-white/60">
          #{room.code}
        </span>
      </div>

      {/* One dot per seat, filled when taken */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: room.maxPlayers }).map((_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border-2 ${
              i < room.players.length
                ? "border-white bg-accent"
                : "border-dashed border-white/40"
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-white/65">
          {room.players.length}/{room.maxPlayers}
        </span>
        {host && (
          <span className="ml-auto truncate text-xs text-white/55">
            Host: {host.username}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rules.length === 0 ? (
          <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-white/60">
            Classic rules
          </span>
        ) : (
          rules.map((rule) => (
            <span
              key={rule}
              className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs"
            >
              {rule}
            </span>
          ))
        )}
      </div>

      <button
        type="button"
        className="btn btn-accent mt-auto"
        disabled={full || status !== "open"}
        onClick={join}
      >
        {full ? "Full" : "Join"}
      </button>

      <dialog ref={dialog} className="modal">
        <form onSubmit={submit} className="modal-box animate-pop">
          <h3 className="text-display text-2xl">Join "{room.name}"</h3>
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
              className="btn btn-ghost"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent">
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

interface Props {
  rooms: RoomInfo[] | null;
  error: string | null;
  // Opens the "new room" pop-up (empty state)
  onCreate: () => void;
}

// The open rooms, as a grid of cards
export function RoomList({ rooms, error, onCreate }: Props) {
  if (error)
    return (
      <div role="alert" className="alert alert-error">
        <span>{error}</span>
      </div>
    );

  if (!rooms)
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-56 rounded-box bg-black/25" />
        ))}
      </div>
    );

  if (rooms.length === 0)
    return (
      <div className="panel-glass flex flex-col items-center gap-4 rounded-box border px-5 py-12 text-center">
        <div className="animate-hop text-6xl" aria-hidden="true">
          🃏
        </div>
        <p className="text-white/80">
          No room yet. Be the one who starts the chaos.
        </p>
        <button type="button" className="btn btn-accent" onClick={onCreate}>
          Create a room
        </button>
      </div>
    );

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {rooms.map((room, index) => (
        <RoomCard key={room.code} room={room} index={index} />
      ))}
    </ul>
  );
}
