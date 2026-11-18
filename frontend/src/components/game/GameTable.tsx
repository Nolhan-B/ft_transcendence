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
  red: "before:bg-primary/25",
  blue: "before:bg-secondary/25",
  yellow: "before:bg-accent/25",
  green: "before:bg-success/25",
  wild: "before:bg-transparent",
};

// Width of a card on the table: the Card component is sized by its parent
const PILE = "w-24 sm:w-28 short:w-16";
// The discard pile is bigger: it is the card to play on
const DISCARD = "w-32 sm:w-40 short:w-24";
const BORDER = "w-full border-[5px]! short:border-[3px]!";

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
      className={`relative isolate flex items-center justify-center gap-4 rounded-box before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:transition-colors before:duration-500 before:content-[''] ${VEIL[state.currentColor]}  border-2 border-base-content/10 bg-base-300 px-3 py-8 shadow-inner sm:gap-6 sm:px-5 sm:py-14 short:gap-3 short:px-2 short:py-4`}
    >
      <div className="flex flex-col items-center gap-2 short:gap-1">
        <button
          type="button"
          disabled={!myTurn}
          onClick={onDraw}
          aria-label="Draw a card"
          data-anchor="draw"
          className={`${PILE} cursor-pointer transition-transform enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Card color="neutral" className={BORDER}>
            <CardBack />
          </Card>
        </button>
        <span className="badge badge-outline">
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
          <Card color={themeColor(state.topCard.color)} className={BORDER}>
            <CardFace value={state.topCard.value} />
          </Card>
        </div>
        <span className="badge badge-outline">Discard pile</span>
      </div>

      {/* Whose turn it is: the text takes the color to play */}
      <div
        className={`flex w-32 flex-col items-center gap-2 rounded-box border-2 border-base-content/10 bg-base-200 p-3 text-center short:w-24 short:gap-1 short:p-2 ${TEXT[state.currentColor]}`}
        aria-label={`Color to play: ${state.currentColor}`}
      >
        <span className="w-full truncate text-lg font-bold short:text-base">
          {turnName}
        </span>
        <div className="flex h-14 items-center justify-center short:h-12">
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
        <span className="text-3xl" title="Direction of play">
          {state.direction === 1 ? "↻" : "↺"}
        </span>
      </div>
    </div>
  );
}
