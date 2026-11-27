import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameMode } from "shared";
import { useAuth } from "../../hooks/auth/useAuth";
import { UserAvatar } from "../user/UserAvatar";
import { useGame } from "../../hooks/ws/useGame";

const REFRESH_MS = 5000;

// A game in progress, as GET /api/game/games/live gives it (no card at all)
interface LiveGame {
  id: string;
  mode: GameMode;
  players: {
    userId: string;
    username: string;
    cardCount: number;
    isCurrentTurn: boolean;
  }[];
}

// The games in progress, asked again every few seconds
function useLiveGames() {
  const [games, setGames] = useState<LiveGame[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/game/games/live", {
        credentials: "include",
      });
      if (response.ok) setGames(await response.json());
    } catch {
      // Keep the last list: the next refresh will try again
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return games;
}

// Lobby section: the games being played right now, to watch as a spectator
// (or to go back to, when I am one of the players)
export function LiveGames() {
  const games = useLiveGames();
  const { user } = useAuth();
  const [hideMyGame, setHideMyGame] = useState(false);
  const { gameState } = useGame();

  useEffect(() => {
    if (gameState?.status === "finished") {
      setHideMyGame(true);
    } else {
      setHideMyGame(false);
    }
  }, [gameState]);

  if (!games || games.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-display text-2xl">
        Live games
        <span className="ml-2 align-middle text-base font-semibold text-white/55">
          {games.length}
        </span>
      </h2>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {games.map((game) => {
          const mine = game.players.some((p) => p.userId === user?.id);
          return (
            <li
              key={game.id}
              className="panel-glass flex flex-col gap-3 rounded-box border p-5"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-sm font-semibold tracking-wider uppercase">
                  Live
                </span>
                <span
                  className={`badge ml-auto border-0 font-semibold uppercase ${
                    game.mode === "ranked"
                      ? "bg-accent text-accent-content"
                      : "bg-secondary text-secondary-content"
                  }`}
                >
                  {game.mode}
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {game.players.map((player) => (
                  <li
                    key={player.userId}
                    className={`flex items-center gap-2 rounded-full py-0.5 pr-3 pl-0.5 ${
                      player.isCurrentTurn ? "bg-accent/20" : ""
                    }`}
                  >
                    <UserAvatar username={player.username} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {player.username}
                    </span>
                    <span
                      className={`text-sm ${player.cardCount === 1 ? "font-bold text-accent" : "text-white/65"}`}
                    >
                      🂠 {player.cardCount}
                    </span>
                  </li>
                ))}
              </ul>

              {mine ? (
                !hideMyGame && (
                  <Link
                    to={`/games/${game.id}`}
                    className="btn btn-accent mt-auto"
                  >
                    Back to my game
                  </Link>
                )
              ) : (
                <Link
                  to={`/games/${game.id}/spectate`}
                  className="btn btn-secondary mt-auto"
                >
                  👁 Watch
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
