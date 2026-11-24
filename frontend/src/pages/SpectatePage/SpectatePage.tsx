import { useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { GameBoard } from "../../components/game/GameBoard";
import { GameOverDialog } from "../../components/game/GameOverDialog";
import { useGame } from "../../hooks/ws/useGame";

// Watch a game in progress: the real board, every hand hidden, no action.
// The server sends the same updates as to the players.
export function SpectatePage() {
  const { id } = useParams();
  const {
    gameState,
    winnerId,
    status,
    refusedGame,
    spectateGame,
    leaveSpectate,
  } = useGame();
  const navigate = useNavigate();
  // The game watched on the current connection (StrictMode runs effects twice)
  const watched = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "open") {
      watched.current = null;
      return;
    }
    if (id && watched.current !== id) {
      watched.current = id;
      spectateGame(id);
    }
  }, [id, status, spectateGame]);

  // Leaving the page (or watching another game): stop receiving this one
  useEffect(() => {
    if (!id) return;
    return () => {
      watched.current = null;
      leaveSpectate(id);
    };
  }, [id, leaveSpectate]);

  function backToLobby() {
    navigate("/play");
  }

  // My own game: play it instead of watching it
  if (
    refusedGame &&
    refusedGame.id === id &&
    refusedGame.reason === "is_player"
  )
    return <Navigate to={`/games/${id}`} replace />;

  if (refusedGame?.id === id)
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="panel-glass animate-pop flex w-full max-w-md flex-col items-center gap-5 rounded-box border px-6 py-10 text-center">
          <div className="text-7xl" aria-hidden="true">
            🃏
          </div>
          <h1 className="text-display text-4xl sm:text-5xl">Game not found</h1>
          <p className="text-white/75">
            This game does not exist, or it is already over.
          </p>
          <button
            type="button"
            className="btn btn-accent btn-lg"
            onClick={backToLobby}
          >
            Back to the lobby
          </button>
        </div>
      </div>
    );

  const state = gameState?.id === id ? gameState : null;

  if (!state)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
        <span
          className="loading loading-dots loading-lg text-accent"
          aria-hidden="true"
        />
        <p className="text-lg font-semibold" role="status">
          {status === "open"
            ? "Taking a seat in the stands..."
            : "Connecting..."}
        </p>
        <Link to="/play" className="btn btn-ghost">
          Back to the lobby
        </Link>
      </div>
    );

  const winner = state.players.find(
    (player) => player.userId === (winnerId ?? state.winnerId),
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 short:gap-1">
      {/* Spectator banner: what this is, and the way out */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 font-semibold">
          <span aria-hidden="true">👁</span>
          Spectating
          <span className="hidden font-normal text-white/60 sm:inline">
            · {state.players.map((p) => p.username).join(" vs ")}
          </span>
        </span>
        <Link to="/play" className="btn btn-sm">
          Leave
        </Link>
      </div>

      {winner && (
        <GameOverDialog
          title={`${winner.username} won the game`}
          onLeave={backToLobby}
        />
      )}

      <GameBoard state={state} myId="" spectator />
    </div>
  );
}
