import { createPortal } from "react-dom";
import type { GameState, PlayerLeftReason } from "shared";

interface Props {
  state: GameState;
  myId: string;
  // Why I left this game, if the server said it (lost after a page reload)
  reason: PlayerLeftReason | undefined;
  onWatch: () => void;
  onLeave: () => void;
}

// Shown when I am out of a game still in progress: removed by the server
// (AFK or away too long), or done in ranked (no card left, the others go
// on). The player is never held in the game: they can leave at once, or
// watch the end without playing. Leaving is already punished by the
// server: the game counts as a loss, and in ranked the player is ranked
// last and loses ELO.
export function OutOfGameScreen({
  state,
  myId,
  reason,
  onWatch,
  onLeave,
}: Props) {
  const ranked = state.mode === "ranked";
  const place = state.ranking.indexOf(myId) + 1;
  const finished = place > 0;

  let icon: string;
  let title: string;
  let why: string;
  let penalty: string | null;

  if (finished) {
    icon = place === 1 ? "🏆" : "🏁";
    title = `You finished #${place}`;
    why =
      "You have no card left. The others are still playing for the next places.";
    penalty = null;
  } else {
    icon = "⛔";
    title = "You were removed from this game";
    why =
      reason === "afk"
        ? "You missed 2 turns in a row."
        : reason === "abandoned"
          ? "You were away for more than 30 seconds."
          : "You missed 2 turns in a row, or were away for more than 30 seconds.";
    penalty = ranked
      ? "This game counts as a loss: you are ranked last and lose ELO."
      : "This game counts as a loss.";
  }

  // In <body>, like the game effects (CardFlights, ActionBursts): inside the
  // game layout (isolate) the pop-up was drawn under them
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-labelledby="out-of-game-title"
        className="panel-glass animate-pop flex w-full max-w-md flex-col items-center gap-4 rounded-box border px-6 py-8 text-center"
      >
        <div className="text-6xl" aria-hidden="true">
          {icon}
        </div>
        <h1 id="out-of-game-title" className="text-display text-3xl">
          {title}
        </h1>
        <p className="text-white/80">{why}</p>
        {penalty && (
          <p className="rounded-box bg-error/15 px-4 py-2 text-sm font-semibold text-error">
            {penalty}
          </p>
        )}
        <p className="text-sm text-white/60">
          You can play another game right away.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-accent" onClick={onLeave}>
            Back to the lobby
          </button>
          <button type="button" className="btn" onClick={onWatch}>
            Watch the end
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
