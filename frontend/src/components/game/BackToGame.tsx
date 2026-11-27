import { Link, useLocation } from "react-router-dom";
import type { GameStatus } from "shared";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

const IN_PROGRESS = "in_progress" as GameStatus;

// Shown on the other pages while I still play a game: a way back to it.
// The game goes on without me in the meantime (turn timer, bots...).
export function BackToGame() {
  const { user } = useAuth();
  const { gameId, gameState, winnerId } = useGame();
  const { pathname } = useLocation();

  const me = gameState?.players.find((player) => player.userId === user?.id);
  if (
    !gameId ||
    gameState?.id !== gameId ||
    gameState.status !== IN_PROGRESS ||
    winnerId !== null ||
    !me ||
    me.disconnected ||
    pathname === `/games/${gameId}`
  )
    return null;

  return (
    <div className="toast toast-bottom toast-center z-40">
      <div role="status" className="alert alert-info shadow-2xl">
        <span className="font-semibold">
          {me.isCurrentTurn
            ? "It's your turn in your game!"
            : "You are still in a game"}
        </span>
        <Link
          to={`/games/${gameId}`}
          className={`btn btn-sm ${me.isCurrentTurn ? "btn-warning animate-pulse" : "btn-neutral"}`}
        >
          Back to game
        </Link>
      </div>
    </div>
  );
}
