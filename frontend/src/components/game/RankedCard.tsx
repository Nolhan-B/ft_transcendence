import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

// Matchmaking banner of the lobby: the server pairs players of a close ELO
export function RankedCard() {
  const { user } = useAuth();
  const { inQueue, joinQueue, leaveQueue, status } = useGame();

  return (
    <div
      className={`panel-glass flex flex-wrap items-center gap-4 rounded-box border p-4 sm:p-5 ${
        inQueue ? "animate-turn" : ""
      }`}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-2xl text-accent-content">
        🏆
      </div>
      <div className="min-w-48 flex-1">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          Ranked game
          <span className="badge border-0 bg-white/15 font-semibold">
            ELO {user?.elo}
          </span>
        </h2>
        <p className="text-sm text-white/70">
          {inQueue
            ? "Looking for an opponent of your level..."
            : "Find an opponent of your level. The result changes your ELO."}
        </p>
      </div>

      {inQueue ? (
        <div className="flex items-center gap-3">
          <span
            className="loading loading-dots text-accent"
            aria-hidden="true"
          />
          <button type="button" className="btn" onClick={leaveQueue}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={status !== "open"}
          onClick={joinQueue}
        >
          Find a game
        </button>
      )}
    </div>
  );
}
