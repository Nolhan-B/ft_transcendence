import type { Player } from "shared";
import { Card } from "../cards/Card";
import { UserAvatar } from "../user/UserAvatar";
import { CardBack } from "./CardFace";

export type Seat = "top" | "left" | "right";

// Hidden cards shown at most (the badge gives the real count)
const MAX_BACKS = 7;

interface Props {
  player: Player;
  // Shows the "Catch UNO" button: one card left and UNO not said yet
  canCatchUno: boolean;
  onCatchUno: () => void;
}

// One opponent: a square with avatar, name and number of cards
export function OpponentSeat({ player, canCatchUno, onCatchUno }: Props) {
  return (
    <div
      data-anchor={`seat-${player.userId}`}
      className={`card relative aspect-square w-52 items-center justify-center gap-1 bg-base-200/70 p-2 shadow-xl backdrop-blur-sm transition-shadow compact:w-36 snug:w-32 short:w-32 short:gap-0.5 short:p-1 tiny:aspect-auto tiny:w-24 ${
        player.isCurrentTurn ? "ring-4 ring-accent" : ""
      } ${player.disconnected ? "opacity-40" : ""}`}
    >
      <div className="compact:hidden">
        <UserAvatar username={player.username} size="md" />
      </div>
      <div className="hidden compact:block tiny:hidden">
        <UserAvatar username={player.username} size="sm" />
      </div>
      <span className="w-full truncate text-center text-base font-semibold compact:text-sm tiny:text-xs">
        {player.username}
      </span>

      {/* The hidden hand, a flat row of overlapping cards */}
      <div
        className="flex -space-x-6 pt-1 compact:-space-x-5 short:-space-x-4 short:pt-0 tiny:-space-x-2"
        aria-hidden="true"
      >
        {Array.from({ length: Math.min(player.hand.length, MAX_BACKS) }).map(
          (_, i) => (
            <Card
              key={i}
              color="neutral"
              variant="neon"
              className="w-11 border-2! compact:w-8 short:w-6 tiny:w-4"
            >
              <CardBack />
            </Card>
          ),
        )}
      </div>
      <span className="badge badge-lg badge-primary text-xl font-bold compact:badge-md compact:text-base short:badge-sm short:text-sm tiny:badge-xs tiny:text-xs">
        {player.hand.length} cards
      </span>

      {canCatchUno && (
        <button
          type="button"
          className="btn btn-error btn-sm absolute -bottom-4 z-10 animate-pulse shadow-[0_0_20px_var(--color-error)] compact:btn-xs compact:-bottom-3"
          onClick={onCatchUno}
        >
          Catch UNO
        </button>
      )}
    </div>
  );
}
