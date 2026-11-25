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
    winnerId
  } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    const finished = winnerId !== null;
    if (gameId && !finished) navigate(`/games/${gameId}`);
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

      {/* Mode and code of the room: the code is what friends need to join */}
      <div className="panel-glass flex flex-wrap items-center justify-between gap-4 rounded-box border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-lg badge-secondary font-bold uppercase tracking-wider">
            {room.mode}
          </span>
          {room.hasPassword && (
            <span className="badge badge-lg badge-accent font-bold uppercase tracking-wider">
              Private
            </span>
          )}
        </div>
        {/* The code as a white ticket, slightly tilted */}
        <div className="flex rotate-2 flex-col items-center rounded-2xl bg-white px-6 py-2 text-ink shadow-[0_6px_0_rgb(0_0_0/0.25)] transition-transform hover:-rotate-2 hover:scale-105">
          <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Room code
          </span>
          <span className="text-3xl font-bold tracking-[0.2em] text-primary">
            {room.code}
          </span>
        </div>
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

      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Why nothing happens yet: the disabled button alone is hard to see */}
        {isLeader && room.players.length < 2 && (
          <span className="text-sm font-semibold text-warning">
            Add a player or a bot to start
          </span>
        )}
        {!isLeader && (
          <span className="text-sm font-semibold text-info">
            Waiting for the leader to start the game...
          </span>
        )}
        <button type="button" className="btn btn-lg" onClick={leave}>
          Leave
        </button>
        {isLeader && (
          <button
            type="button"
            className="btn btn-accent btn-lg"
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
