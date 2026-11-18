import type { CardColor as GameColor, GameState } from "shared";
import { Card } from "../cards/Card";
import { CardBack, CardFace } from "./CardFace";
import { cardName, themeColor } from "./cards";

// Dot of the color in play (wild cards pick it)
const DOTS: Record<GameColor, string> = {
  red: "bg-primary",
  blue: "bg-secondary",
  yellow: "bg-accent",
  green: "bg-success",
  wild: "bg-neutral",
};

// Width of a card on the table: the Card component is sized by its parent
const PILE = "w-24 sm:w-28 short:w-16";
const BORDER = "w-full border-[5px]! short:border-[3px]!";

interface Props {
  state: GameState;
  myTurn: boolean;
  onDraw: () => void;
}

// The central board, laid out horizontally: draw pile, discard pile (top
// card) and the current color / direction
export function GameTable({ state, myTurn, onDraw }: Props) {
  return (
    <div className="flex items-center justify-center gap-6 rounded-box border-2 border-base-content/10 bg-base-300 p-4 shadow-inner sm:gap-12 sm:p-8 short:gap-6 short:p-2">
      <div className="flex flex-col items-center gap-2 short:gap-1">
        <button
          type="button"
          disabled={!myTurn}
          onClick={onDraw}
          aria-label="Draw a card"
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
        <div className={PILE} role="img" aria-label={cardName(state.topCard)}>
          <Card color={themeColor(state.topCard.color)} className={BORDER}>
            <CardFace value={state.topCard.value} />
          </Card>
        </div>
        <span className="badge badge-outline">Discard pile</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:inline">Color</span>
          <span
            role="img"
            aria-label={`Current color: ${state.currentColor}`}
            className={`size-8 rounded-full ring-2 ring-base-content/30 short:size-6 ${DOTS[state.currentColor]}`}
          />
        </div>
        <span className="text-2xl" title="Direction of play">
          {state.direction === 1 ? "↻" : "↺"}
        </span>
      </div>
    </div>
  );
}
