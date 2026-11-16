import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

// Matchmaking: the server pairs players of a close ELO
export function RankedCard() {
  const { user } = useAuth();
  const { inQueue, joinQueue, leaveQueue, status } = useGame();

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          Ranked game
          <span className="badge badge-accent">ELO {user?.elo}</span>
        </h2>
        <p className="opacity-80">
          Find an opponent of your level. The result changes your ELO.
        </p>

        <div className="card-actions items-center justify-end gap-3">
          {inQueue ? (
            <>
              <span className="loading loading-dots" aria-hidden="true" />
              <span>Searching...</span>
              <button type="button" className="btn" onClick={leaveQueue}>
                Cancel
              </button>
            </>
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
      </div>
    </div>
  );
}
