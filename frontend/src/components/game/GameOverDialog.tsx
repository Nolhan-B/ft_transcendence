import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useCountdown } from "../../hooks/game/useCountdown";

const REDIRECT_SECONDS = 5;

// Confetti in the four colors: [color, left, delay, duration]
const CONFETTI = Array.from({ length: 40 }, (_, i) => [
  ["bg-primary", "bg-accent", "bg-success", "bg-secondary"][i % 4],
  `${(i * 37) % 100}%`,
  `${((i * 13) % 20) / 10}s`,
  `${2.5 + ((i * 7) % 15) / 10}s`,
]);

interface Props {
  title: string;
  // Called after a few seconds, or when the button is pressed
  onLeave: () => void;
}

// End of the game: a pop-up that sends everybody back to the lobby
export function GameOverDialog({ title, onLeave }: Props) {
  const [shownAt] = useState(() => Date.now());
  const left = useCountdown(shownAt, REDIRECT_SECONDS);

  useEffect(() => {
    if (left === 0) onLeave();
  }, [left, onLeave]);

  return (
    <dialog className="modal modal-open">
      {/* Confetti falling over the whole screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden"
      >
        {CONFETTI.map(([color, x, delay, duration], i) => (
          <i
            key={i}
            className={`absolute -top-5 h-4 w-2.5 rounded-xs ${color} animate-[confetti_linear_infinite]`}
            style={
              {
                left: x,
                animationDelay: delay,
                animationDuration: duration,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="modal-box animate-pop relative text-center">
        <div className="text-6xl" aria-hidden="true">
          🏆
        </div>
        <h3 className="text-display mt-3 text-4xl text-accent">{title}</h3>
        <p className="mt-4 opacity-80">Back to the lobby in {left}s</p>
        <progress
          className="progress progress-accent mt-2 w-full"
          value={left ?? REDIRECT_SECONDS}
          max={REDIRECT_SECONDS}
        />
        <div className="modal-action justify-center">
          <button
            type="button"
            className="btn btn-accent btn-lg"
            onClick={onLeave}
          >
            Back now
          </button>
        </div>
      </div>
    </dialog>
  );
}
