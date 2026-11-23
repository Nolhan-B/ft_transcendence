import type { CardColor as GameColor, GameState } from "shared";
import { Card } from "../cards/Card";
import { TurnTimer } from "./TurnTimer";
import { CardBack, CardFace } from "./CardFace";
import { cardName, themeColor } from "./cards";

// Text color following the color in play (wild: the normal text color)
const TEXT: Record<GameColor, string> = {
  red: "text-primary",
  blue: "text-secondary",
  yellow: "text-accent",
  green: "text-success",
  wild: "text-base-content",
};

// Translucent veil over the table, in the color to play
const VEIL: Record<GameColor, string> = {
  red: "before:bg-primary/40",
  blue: "before:bg-secondary/40",
  yellow: "before:bg-accent/40",
  green: "before:bg-success/40",
  wild: "before:bg-transparent",
};

// Width of a card on the table: the Card component is sized by its parent
const PILE = "w-24 sm:w-28 compact:w-20 snug:w-14 short:w-14 tiny:w-12";
// The discard pile is bigger: it is the card to play on
const DISCARD = "w-32 sm:w-40 compact:w-24 snug:w-20 short:w-20 tiny:w-14";
// Inlaid in the felt: no white border, no cast shadow
const BORDER = "w-full border-0! shadow-none!";

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

// The central board, laid out horizontally: draw pile, discard pile (top
// card) and the current color / direction
export function GameTable({
  state,
  myTurn,
  onDraw,
  turnName,
  secondsLeft,
  turnSeconds,
  botTurn,
}: Props) {
  return (
    <div
      className={`relative isolate flex items-center justify-center gap-4 rounded-box before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:transition-colors before:duration-500 before:content-[''] ${VEIL[state.currentColor]}  border-4 border-base-100 bg-base-300 px-3 py-8 shadow-[inset_0_0_40px_var(--color-base-300),0_10px_30px_var(--color-base-300)] sm:gap-6 sm:px-5 sm:py-14 compact:gap-3 compact:px-3 compact:py-4 snug:py-2 short:gap-2 short:px-2 short:py-2 tiny:border-2 tiny:py-1`}
    >
      {/* Felt grain and the stitched edge of the cloth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-felt opacity-60 mix-blend-overlay"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 -z-10 rounded-[inherit] border-2 border-dashed border-base-content/20"
      />
      <div className="flex flex-col items-center gap-2 short:gap-1">
        <button
          type="button"
          disabled={!myTurn}
          onClick={onDraw}
          aria-label="Draw a card"
          data-anchor="draw"
          className={`${PILE} cursor-pointer transition-transform enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Card color="neutral" variant="neon" className={BORDER}>
            <CardBack />
          </Card>
        </button>
        <span className="badge border-0 tiny:badge-xs bg-base-200/70 backdrop-blur-sm">
          {state.pendingDrawCount > 0
            ? `Draw ${state.pendingDrawCount}`
            : `Draw pile (${state.drawPileCount})`}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 short:gap-1">
        <div
          className={DISCARD}
          role="img"
          aria-label={cardName(state.topCard)}
          data-anchor="discard"
        >
          <Card
            color={themeColor(state.topCard.color)}
            variant="neon"
            className={BORDER}
          >
            <CardFace value={state.topCard.value} />
          </Card>
        </div>
        <span className="badge border-0 tiny:badge-xs bg-base-200/70 backdrop-blur-sm">
          Discard pile
        </span>
      </div>

      {/* Whose turn it is: the text takes the color to play */}
      <div
        className={`flex w-32 flex-col items-center gap-2 rounded-box border-2 border-base-content/10 bg-base-200/70 p-3 backdrop-blur-sm text-center compact:w-28 compact:gap-1 compact:p-2 snug:w-24 snug:p-1 short:w-24 tiny:w-20 tiny:p-1 ${TEXT[state.currentColor]}`}
        aria-label={`Color to play: ${state.currentColor}`}
      >
        <span className="w-full truncate text-lg font-bold compact:text-base tiny:text-xs">
          {turnName}
        </span>
        <div className="flex h-14 items-center justify-center compact:h-11 snug:h-10 short:h-10 tiny:h-9">
          {secondsLeft !== null && (
            <TurnTimer secondsLeft={secondsLeft} total={turnSeconds} />
          )}
          {botTurn && (
            <span
              className="loading loading-dots loading-lg"
              role="status"
              aria-label="The bot is playing"
            />
          )}
        </div>
        <span
          className="text-3xl compact:text-2xl tiny:text-xl"
          title="Direction of play"
        >
          {state.direction === 1 ? "↻" : "↺"}
        </span>
      </div>
    </div>
  );
}
