import type { Player } from "shared";
import { Hand } from "../cards/Hand";
import type { HandCard } from "../cards/Hand";
import { UserAvatar } from "../user/UserAvatar";
import { CardBack } from "./CardFace";

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
  const backs: HandCard[] = Array.from(
    { length: Math.min(player.hand.length, MAX_BACKS) },
    (_, i) => ({
      id: `${player.userId}-${i}`,
      color: "neutral",
      label: "Hidden card",
      content: <CardBack />,
    }),
  );
  // The top seat puts the name next to the avatar, the side seats under it
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

      {/* The hidden hand, as a small fan */}
      <div className="hidden pt-2 sm:block short:hidden" aria-hidden="true">
        <Hand
          cards={backs}
          step={6}
          className="w-9"
          cardClassName="border-2!"
        />
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
