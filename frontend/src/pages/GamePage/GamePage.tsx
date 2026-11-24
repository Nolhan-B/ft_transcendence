import { useEffect, useRef } from "react";
import type { GameStatus } from "shared";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GameBoard } from "../../components/game/GameBoard";
import { GameOverDialog } from "../../components/game/GameOverDialog";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

const FINISHED = "finished" as GameStatus;

export function GamePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { gameState, winnerId, status, refusedGame, joinGame, clearGame } =
    useGame();
  const navigate = useNavigate();
  // The game to join once per connection (StrictMode runs effects twice)
  const joined = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "open") {
      joined.current = null;
      return;
    }
    if (id && joined.current !== id) {
      joined.current = id;
      joinGame(id);
    }
  }, [id, status, joinGame]);

  function backToLobby() {
    clearGame();
    navigate("/play");
  }

  const state = gameState?.id === id ? gameState : null;
  const finished = !!state && (winnerId !== null || state.status === FINISHED);
  const winner = state?.players.find(
    (player) => player.userId === (winnerId ?? state.winnerId),
  );

  // The server would not let us in: no such game, or not one of ours
  if (refusedGame && refusedGame.id === id) {
    const notFound = refusedGame.reason === "not_found";
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="panel-glass animate-pop flex w-full max-w-md flex-col items-center gap-5 rounded-box border px-6 py-10 text-center">
          <div className="text-7xl" aria-hidden="true">
            {notFound ? "🃏" : "🔒"}
          </div>
          <h1 className="text-display text-4xl sm:text-5xl">
            {notFound ? "Game not found" : "Not your game"}
          </h1>
          <p className="text-white/75">
            {notFound
              ? "This game does not exist, or it is already over."
              : "You are not one of the players of this game."}
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
  }

  // Waiting for the first state of the game
  if (!state || !user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
        <span
          className="loading loading-dots loading-lg text-accent"
          aria-hidden="true"
        />
        <p className="text-lg font-semibold" role="status">
          {status === "open" ? "Joining the game..." : "Connecting..."}
        </p>
        <Link to="/play" className="btn btn-ghost" onClick={clearGame}>
          Back to the lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 short:gap-2">
      {finished && (
        <GameOverDialog
          title={
            winner?.userId === user.id
              ? "You won!"
              : `${winner?.username ?? "Someone"} won the game`
          }
          onLeave={backToLobby}
        />
      )}
      <GameBoard state={state} myId={user.id} />
    </div>
  );
}
