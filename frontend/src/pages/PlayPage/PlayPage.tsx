import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateRoomForm } from "../../components/game/CreateRoomForm";
import { JoinByCodeForm } from "../../components/game/JoinByCodeForm";
import { LiveGames } from "../../components/game/LiveGames";
import { RankedCard } from "../../components/game/RankedCard";
import { RoomList } from "../../components/game/RoomList";
import { useRooms } from "../../hooks/game/useRooms";
import { useGame } from "../../hooks/ws/useGame";

// The lobby: ranked matchmaking, join by code, the open rooms as a grid,
// then the games in progress to watch
export function PlayPage() {
  const { room, gameId } = useGame();
  const navigate = useNavigate();
  const { rooms, error, refresh } = useRooms();
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // A game id already known when the page opens is an old one: only a new one
  // (ranked match found) sends us to the game
  const knownGameId = useRef(gameId);

  useEffect(() => {
    if (gameId && gameId !== knownGameId.current) {
      navigate(`/games/${gameId}`);
    } else if (room) {
      navigate(`/play/rooms/${room.code}`);
    }
  }, [gameId, room, navigate]);

  async function reload() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-display text-4xl">Game rooms</h1>
          <p className="mt-1 text-white/70">Pick a table or open your own.</p>
        </div>

        <button
          type="button"
          className="btn btn-accent btn-lg"
          onClick={() => setCreating(true)}
        >
          + New room
        </button>
      </div>

      <RankedCard />
      <JoinByCodeForm />

      {/* Open rooms: title, count and refresh, then the grid */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-display text-2xl">
          Open rooms
          {rooms && (
            <span className="ml-2 align-middle text-base font-semibold text-white/55">
              {rooms.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          className="btn btn-sm"
          aria-label="Refresh the rooms"
          onClick={() => void reload()}
        >
          <span className={refreshing ? "animate-spin" : ""}>⟳</span>
          Refresh
        </button>
      </div>

      <RoomList
        rooms={rooms}
        error={error}
        onCreate={() => setCreating(true)}
      />

      {/* Games being played: watch them as a spectator */}
      <LiveGames />

      <CreateRoomForm open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
