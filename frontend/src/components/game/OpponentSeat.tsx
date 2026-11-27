import type { CSSProperties } from "react";
import type { Player } from "shared";
import { Card } from "../cards/Card";
import { UserAvatar } from "../user/UserAvatar";
import { CardBack } from "./CardFace";

export type Seat = "top" | "left" | "right" | "bottom";

// Hidden cards shown at most (the pill gives the real count)
const MAX_BACKS = 7;

interface Props {
  player: Player;
  // Shows the "Catch UNO" button: one card left and UNO not said yet
  canCatchUno: boolean;
  onCatchUno: () => void;
}

// One opponent: the hidden hand fanned out, then a pill with avatar, name
// and number of cards. The seat glows yellow on its turn.
export function OpponentSeat({ player, canCatchUno, onCatchUno }: Props) {
  const backs = Math.min(player.hand.length, MAX_BACKS);
  const lastCard = player.hand.length === 1;

  return (
    <div
      data-anchor={`seat-${player.userId}`}
      className={`relative flex w-52 flex-col items-center gap-2 rounded-box p-3 transition-[background-color,opacity,filter] duration-300 compact:w-40 compact:gap-1 compact:p-2 snug:w-32 short:w-32 short:gap-0.5 short:p-1 tiny:w-24 phone:w-[28vw] phone:gap-0.5 phone:p-1 ${
        player.isCurrentTurn ? "animate-turn bg-black/30" : ""
      } ${player.disconnected ? "opacity-40 grayscale" : ""}`}
    >
      {/* The hidden hand, a small fan of overlapping backs */}
      <div
        className="flex h-20 items-end justify-center -space-x-7 compact:h-14 compact:-space-x-5 snug:h-11 short:h-10 short:-space-x-4 tiny:h-7 tiny:-space-x-2 phone:h-9 phone:-space-x-4"
        aria-hidden="true"
      >
        {Array.from({ length: backs }).map((_, i) => (
          <div
            key={i}
            className="origin-bottom [rotate:var(--rot)]"
            style={
              { "--rot": `${(i - (backs - 1) / 2) * 7}deg` } as CSSProperties
            }
          >
            <Card
              color="neutral"
              variant="game"
              className="w-12 compact:w-9 snug:w-7 short:w-6 tiny:w-4 phone:w-6"
            >
              <CardBack />
            </Card>
          </div>
        ))}
      </div>

      <div className="flex max-w-full items-center gap-2 rounded-full bg-black/40 py-1.5 pr-4 pl-1.5 compact:gap-1.5 compact:px-3 compact:py-1 tiny:px-2 phone:px-2.5">
        {/* No avatar on smaller screens: the padding is then the same on
            both sides and the text is centered */}
        <div className="shrink-0 compact:hidden">
          <UserAvatar
            username={player.username}
            avatarUrl={player.avatarUrl}
            size="sm"
          />
        </div>
        <div className="flex min-w-0 flex-col leading-tight compact:items-center compact:text-center">
          <span className="truncate font-semibold compact:text-sm tiny:text-xs">
            {player.username}
          </span>
          <span
            className={`text-xs tiny:text-[0.65rem] ${lastCard ? "font-bold text-accent" : "text-white/65"}`}
          >
            {player.hand.length} {player.hand.length === 1 ? "card" : "cards"}
          </span>
        </div>
      </div>

      {canCatchUno && (
        <button
          type="button"
          className="text-display animate-wobble absolute -bottom-4 z-10 cursor-pointer rounded-full border-[3px] border-white bg-primary px-4 py-1 text-lg text-white shadow-[0_0_20px_var(--color-primary)] compact:-bottom-3 compact:text-sm"
          onClick={onCatchUno}
        >
          Catch UNO!
        </button>
      )}
    </div>
  );
}
