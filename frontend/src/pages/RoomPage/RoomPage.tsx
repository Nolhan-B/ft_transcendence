import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RoomPlayers } from "../../components/game/RoomPlayers";
import { RoomSettings } from "../../components/game/RoomSettings";
import { MainTitle } from "../../components/texts/MainTitle";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

export function RoomPage() {
  const { user } = useAuth();
  const {
    room,
    gameId,
    leaveRoom,
    startGame,
    updateSettings,
    addBot,
    removeBot,
  } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (gameId) navigate(`/games/${gameId}`);
    // No room (page reloaded, room closed): back to the lobby
    else if (!room) navigate("/play");
  }, [gameId, room, navigate]);

  if (!room) return null;

  const isLeader = room.leaderId === user?.id;

  function leave() {
    leaveRoom();
    navigate("/play");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <MainTitle title={room.name} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="badge badge-outline capitalize">{room.mode}</span>
        {room.hasPassword && <span className="badge badge-ghost">Private</span>}
        <span className="text-sm opacity-70">
          Room code <kbd className="kbd kbd-sm">{room.code}</kbd>
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RoomPlayers
          room={room}
          isLeader={isLeader}
          onAddBot={addBot}
          onRemoveBot={removeBot}
        />
        <RoomSettings
          settings={room.settings}
          editable={isLeader}
          onChange={updateSettings}
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn" onClick={leave}>
          Leave
        </button>
        {isLeader && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={room.players.length < 2}
            onClick={startGame}
          >
            Start the game
          </button>
        )}
      </div>
    </div>
  );
}
