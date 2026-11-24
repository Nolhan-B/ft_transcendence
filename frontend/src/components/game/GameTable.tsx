import type { CardColor as GameColor, GameState } from "shared";
import { Card } from "../cards/Card";
import { TurnTimer } from "./TurnTimer";
import { CardBack, CardFace } from "./CardFace";
import { cardName, themeColor } from "./cards";

// Ring around the discard pile, in the color to play (wild: white)
const RING: Record<GameColor, string> = {
  red: "border-primary shadow-[0_0_30px_var(--color-primary)]",
  blue: "border-secondary shadow-[0_0_30px_var(--color-secondary)]",
  yellow: "border-accent shadow-[0_0_30px_var(--color-accent)]",
  green: "border-success shadow-[0_0_30px_var(--color-success)]",
  wild: "border-white/60 shadow-[0_0_30px_rgb(255_255_255/0.4)]",
};

// Name of the color to play, in its color
const TEXT: Record<GameColor, string> = {
  red: "text-primary",
  blue: "text-secondary",
  yellow: "text-accent",
  green: "text-success",
  wild: "text-white",
};

// Width of a card on the table: the Card component is sized by its parent
const PILE = "w-24 sm:w-28 compact:w-20 snug:w-14 short:w-14 tiny:w-12";
// The discard pile is bigger: it is the card to play on
const DISCARD = "w-28 sm:w-36 compact:w-24 snug:w-20 short:w-20 tiny:w-14";

interface Props {
  state: GameState;
  myTurn: boolean;
  onDraw: () => void;
  // Name of the player whose turn it is, and the seconds left (null: no timer)
  turnName: string;
  secondsLeft: number | null;
  turnSeconds: number;
  // A bot is playing: no timer, shown as "thinking"
  botTurn: boolean;
}

// The middle of the table: the draw pile, the discard pile (top card) with a
// ring in the color to play, the direction of play turning behind them and
// a small panel telling whose turn it is
export function GameTable({
  state,
  myTurn,
  onDraw,
  turnName,
  secondsLeft,
  turnSeconds,
  botTurn,
}: Props) {
  const clockwise = state.direction === 1;

  return (
    <div className="relative isolate flex items-center justify-center gap-10 py-6 sm:gap-14 compact:gap-6 compact:py-3 snug:gap-4 snug:py-1 short:gap-3 short:py-1 tiny:gap-2">
      {/* Direction of play: a dashed ring slowly turning behind the piles */}
      <div
        aria-hidden="true"
        title="Direction of play"
        className={`animate-spin-slow pointer-events-none absolute top-1/2 left-1/2 -z-10 grid size-80 -translate-x-1/2 -translate-y-1/2 place-items-start justify-center rounded-full border-[3px] border-dashed border-white/15 text-4xl text-white/25 compact:size-60 compact:text-3xl snug:size-44 snug:text-2xl short:size-44 tiny:size-32 ${clockwise ? "" : "[animation-direction:reverse]"}`}
      >
        <span className={`-mt-[0.6em] ${clockwise ? "" : "rotate-180"}`}>
          ➜
        </span>
      </div>

      {/* Draw pile: a small stack, it hops when I can draw */}
      <div className="flex flex-col items-center gap-3 short:gap-1">
        <button
          type="button"
          disabled={!myTurn}
          onClick={onDraw}
          aria-label="Draw a card"
          data-anchor="draw"
          className={`group relative ${PILE} cursor-pointer disabled:cursor-not-allowed`}
        >
          {/* Two cards under the top one, slightly offset */}
          <div className="absolute inset-0 translate-x-[-6px] translate-y-[6px] -rotate-4">
            <Card color="neutral" variant="game">
              <CardBack />
            </Card>
          </div>
          <div className="absolute inset-0 translate-x-[-3px] translate-y-[3px] -rotate-2">
            <Card color="neutral" variant="game">
              <CardBack />
            </Card>
          </div>
          <Card
            color="neutral"
            variant="game"
            className={`w-full transition-transform duration-200 ${
              myTurn
                ? "animate-nudge ring-4 ring-accent group-hover:-translate-y-2.5 group-hover:rotate-3 group-hover:animate-none"
                : "brightness-90"
            }`}
          >
            <CardBack />
          </Card>
          {myTurn && (
            <span className="animate-hop absolute -top-7 left-1/2 -translate-x-1/2 text-sm font-bold whitespace-nowrap text-accent compact:-top-6 compact:text-xs snug:hidden">
              Draw!
            </span>
          )}
        </button>
        <span className="text-sm font-semibold text-white/70 tiny:text-xs">
          {state.pendingDrawCount > 0
            ? `Draw ${state.pendingDrawCount}`
            : `${state.drawPileCount} cards`}
        </span>
      </div>

      {/* Discard pile, with the ring in the color to play */}
      <div className="flex flex-col items-center gap-3 short:gap-1">
        <div
          className={`relative ${DISCARD}`}
          role="img"
          aria-label={cardName(state.topCard)}
          data-anchor="discard"
        >
          <div
            aria-hidden="true"
            className={`absolute -inset-3 rounded-[1.4rem] border-[5px] transition-[border-color,box-shadow] duration-500 compact:-inset-2 compact:border-4 tiny:-inset-1 tiny:border-2 ${RING[state.currentColor]}`}
          />
          <Card
            color={themeColor(state.topCard.color)}
            variant="game"
            className="w-full rotate-3"
          >
            <CardFace color={state.topCard.color} value={state.topCard.value} />
          </Card>
          {state.pendingDrawCount > 0 && (
            <span className="animate-pop absolute -top-4 -right-6 z-10 rounded-full border-[3px] border-white bg-primary px-3 py-0.5 text-xl font-bold text-white shadow-lg compact:text-base tiny:-right-3 tiny:px-1.5 tiny:text-xs">
              +{state.pendingDrawCount}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-0.5 text-sm font-semibold capitalize tiny:px-2 tiny:text-xs">
          <span
            className={`size-2.5 rounded-full bg-current ${TEXT[state.currentColor]}`}
          />
          {state.currentColor === "wild" ? "Any color" : state.currentColor}
        </span>
      </div>

      {/* Whose turn it is */}
      <div
        className={`panel-glass flex w-32 flex-col items-center gap-2 rounded-box border p-3 text-center compact:w-28 compact:gap-1 compact:p-2 snug:w-24 snug:p-1 short:w-24 tiny:w-20 tiny:p-1 ${
          myTurn ? "animate-turn" : ""
        }`}
        aria-label={`Color to play: ${state.currentColor}`}
      >
        {myTurn ? (
          <span className="text-display text-xl text-accent compact:text-lg tiny:text-sm">
            Your turn!
          </span>
        ) : (
          <span className="w-full truncate text-lg font-bold compact:text-base tiny:text-xs">
            {turnName}
          </span>
        )}
        <div className="flex h-14 items-center justify-center compact:h-11 snug:h-10 short:h-10 tiny:h-9">
          {secondsLeft !== null && (
            <TurnTimer secondsLeft={secondsLeft} total={turnSeconds} />
          )}
          {botTurn && (
            <span
              className="loading loading-dots loading-lg text-accent"
              role="status"
              aria-label="The bot is playing"
            />
          )}
        </div>
        <span className="text-xs font-semibold text-white/60 tiny:hidden">
          {clockwise ? "Clockwise ↻" : "Counter-clockwise ↺"}
        </span>
      </div>
    </div>
  );
}
