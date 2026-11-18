import type { Player } from "shared";
import { Card } from "../cards/Card";
import { UserAvatar } from "../user/UserAvatar";
import { CardBack } from "./CardFace";

export type Seat = "top" | "left" | "right";

// Hidden cards shown at most (the badge gives the real count)
const MAX_BACKS = 7;

interface Props {
  player: Player;
  // Shows the "Catch UNO" button (rule enabled and one card left)
  canCatchUno: boolean;
  onCatchUno: () => void;
}

// One opponent: a square with avatar, name and number of cards
export function OpponentSeat({ player, canCatchUno, onCatchUno }: Props) {
  return (
    <div
      data-anchor={`seat-${player.userId}`}
      className={`card relative aspect-square w-52 items-center justify-center gap-1 bg-base-200/70 p-2 shadow-xl backdrop-blur-sm transition-shadow short:w-40 ${
        player.isCurrentTurn ? "ring-4 ring-accent" : ""
      } ${player.disconnected ? "opacity-40" : ""}`}
    >
      <UserAvatar username={player.username} size="md" />
      <span className="w-full truncate text-center text-base font-semibold">
        {player.username}
      </span>

      {/* The hidden hand, a flat row of overlapping cards */}
      <div className="flex -space-x-6 pt-1" aria-hidden="true">
        {Array.from({ length: Math.min(player.hand.length, MAX_BACKS) }).map(
          (_, i) => (
            <Card key={i} color="neutral" className="w-11 border-2!">
              <CardBack />
            </Card>
          ),
        )}
      </div>
      <span className="badge badge-lg badge-primary text-xl font-bold">
        {player.hand.length} cards
      </span>

      {canCatchUno && (
        <button
          type="button"
          className="btn btn-warning btn-xs absolute -bottom-3"
          onClick={onCatchUno}
        >
          Catch UNO
        </button>
      )}
    </div>
  );
}
