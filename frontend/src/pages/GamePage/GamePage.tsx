import { useEffect, useRef, useState } from "react";
import type { GameStatus } from "shared";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GameBoard } from "../../components/game/GameBoard";
import { GameOverDialog } from "../../components/game/GameOverDialog";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";
import { RotateDevice } from "../../components/game/RotateDevice";
import { OutOfGameScreen } from "../../components/game/OutOfGameScreen";

const FINISHED = "finished" as GameStatus;

export function GamePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    gameState,
    winnerId,
    status,
    refusedGame,
    leftReasons,
    joinGame,
    clearGame,
  } = useGame();
  // Out of the game, I chose to watch the end: the screen stays closed
  const [watching, setWatching] = useState<string | null>(null);
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

  // Leaving the page (navbar, link, browser back...) while this game is no
  // longer mine (I was removed, or it is over): release it, so the provider
  // goes back to the game I still play, if any. Refs: the cleanup must see
  // the last values, and must only run when the page goes away.
  const released =
    !!state &&
    (finished ||
      (state.players.find((player) => player.userId === user?.id)
        ?.disconnected ??
        false));
  const releasedRef = useRef(released);
  releasedRef.current = released;
  const clearGameRef = useRef(clearGame);
  clearGameRef.current = clearGame;
  useEffect(
    () => () => {
      if (releasedRef.current) clearGameRef.current();
    },
    [id],
  );
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

  // Out of the game while it goes on: removed (AFK, away too long) or done
  // in ranked. I can leave or watch the end, but can no longer play.
  const me = state.players.find((player) => player.userId === user.id);
  const outOfGame = !finished && (me?.disconnected ?? false);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 short:gap-2">
      {/* Phone held upright: the game asks for landscape */}
      <RotateDevice />
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
      {outOfGame && watching !== state.id && (
        <OutOfGameScreen
          state={state}
          myId={user.id}
          reason={leftReasons[user.id]}
          onWatch={() => setWatching(state.id)}
          onLeave={backToLobby}
        />
      )}
      {/* Out of the game: the board only shows, like for a spectator */}
      <GameBoard state={state} myId={user.id} spectator={outOfGame} />
    </div>
  );
}
