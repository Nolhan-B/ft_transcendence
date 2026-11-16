import type { RoomInfo } from "shared";
import { UserAvatar } from "../user/UserAvatar";

interface Props {
  room: RoomInfo;
  isLeader: boolean;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
}

const isBot = (id: string) => id.startsWith("bot_");

export function RoomPlayers({ room, isLeader, onAddBot, onRemoveBot }: Props) {
  const full = room.players.length >= room.maxPlayers;
  const empty = Array.from(
    { length: room.maxPlayers - room.players.length },
    (_, i) => i,
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          Players
          <span className="badge badge-outline">
            {room.players.length} / {room.maxPlayers}
          </span>
        </h2>

        <ul className="list">
          {room.players.map((player) => (
            <li key={player.id} className="list-row items-center">
              <UserAvatar username={player.username} size="md" />
              <div className="list-col-grow flex items-center gap-2 font-semibold">
                {player.username}
                {player.id === room.leaderId && (
                  <span className="badge badge-accent badge-sm">Leader</span>
                )}
                {isBot(player.id) && (
                  <span className="badge badge-ghost badge-sm">Bot</span>
                )}
              </div>
              {isLeader && isBot(player.id) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-error"
                  onClick={() => onRemoveBot(player.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {empty.map((slot) => (
            <li key={slot} className="list-row items-center opacity-50">
              <div className="skeleton h-12 w-12 shrink-0" />
              <div className="list-col-grow">Waiting for a player...</div>
            </li>
          ))}
        </ul>

        {isLeader && (
          <div className="card-actions justify-end">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={full}
              onClick={onAddBot}
            >
              Add a bot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
