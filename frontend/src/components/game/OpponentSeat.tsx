import type { Player } from "shared";
import { PlayingCard } from "./PlayingCard";
import { UserAvatar } from "../user/UserAvatar";

export type Seat = "top" | "left" | "right";

const MAX_BACKS = 7;

interface Props {
  player: Player;
  seat: Seat;
  // Shows the "Catch UNO" button (rule enabled and one card left)
  canCatchUno: boolean;
  onCatchUno: () => void;
}

// One opponent: avatar, name, number of cards and their hidden hand
export function OpponentSeat({ player, seat, canCatchUno, onCatchUno }: Props) {
  const backs = Math.min(player.hand.length, MAX_BACKS);
  // Side seats stack the cards, the top seat spreads them
  const vertical = seat !== "top";

  return (
    <div
      className={`card items-center gap-2 bg-base-200 p-2 shadow-xl transition-shadow sm:p-3 ${
        player.isCurrentTurn ? "ring-4 ring-accent" : ""
      } ${player.disconnected ? "opacity-40" : ""}`}
    >
      <div
        className={`flex flex-col items-center gap-2 ${vertical ? "" : "sm:flex-row sm:gap-3"}`}
      >
        <UserAvatar username={player.username} size="md" />
        <div className="flex flex-col items-center gap-1">
          <span className="max-w-20 truncate text-sm font-semibold sm:max-w-24 sm:text-base">
            {player.username}
          </span>
          <span className="badge badge-outline">
            {player.hand.length} cards
          </span>
        </div>
      </div>

      <div
        className={`hidden sm:flex ${vertical ? "flex-col -space-y-12" : "-space-x-6"}`}
        aria-hidden="true"
      >
        {Array.from({ length: backs }, (_, i) => (
          <PlayingCard key={i} faceDown size="xs" />
        ))}
      </div>

      {canCatchUno && (
        <button
          type="button"
          className="btn btn-warning btn-xs"
          onClick={onCatchUno}
        >
          Catch UNO
        </button>
      )}
    </div>
  );
}
