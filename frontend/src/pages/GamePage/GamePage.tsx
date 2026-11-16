import { useEffect, useRef } from "react";
import type { GameStatus } from "shared";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GameBoard } from "../../components/game/GameBoard";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

const FINISHED = "finished" as GameStatus;

export function GamePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { gameState, winnerId, status, joinGame, clearGame } = useGame();
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

  if (!state || !user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        <div className="skeleton h-64 w-full" />
        <Link to="/play" className="btn btn-ghost">
          Back to the lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {finished && (
        <div role="alert" className="alert alert-success">
          <span className="text-lg font-bold">
            {winner?.userId === user.id
              ? "You won!"
              : `${winner?.username ?? "Someone"} won the game.`}
          </span>
          <button type="button" className="btn btn-sm" onClick={backToLobby}>
            Back to the lobby
          </button>
        </div>
      )}
      <GameBoard state={state} myId={user.id} />
    </div>
  );
}
