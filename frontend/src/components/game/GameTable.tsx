import type { GameState } from "shared";
import { PlayingCard } from "./PlayingCard";

interface Props {
  state: GameState;
  myTurn: boolean;
  onDraw: () => void;
}

// The central board, laid out horizontally: draw pile, discard pile (top
// card) and the current color / direction
export function GameTable({ state, myTurn, onDraw }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-box border-2 border-base-content/10 bg-base-300 p-3 shadow-inner sm:gap-12 sm:p-8 short:gap-6 short:p-2">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={!myTurn}
          onClick={onDraw}
          className="cursor-pointer transition-transform enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Draw a card"
        >
          <PlayingCard faceDown size="lg" />
        </button>
        <span className="badge badge-outline">
          {state.pendingDrawCount > 0
            ? `Draw ${state.pendingDrawCount}`
            : `Draw pile (${state.drawPileCount})`}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <PlayingCard
          color={state.topCard.color}
          value={state.topCard.value}
          size="lg"
        />
        <span className="badge badge-outline">Discard pile</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:inline">Color</span>
          <PlayingCard color={state.currentColor} size="sm" />
        </div>
        <span className="text-2xl" title="Direction of play">
          {state.direction === 1 ? "↻" : "↺"}
        </span>
      </div>
    </div>
  );
}
