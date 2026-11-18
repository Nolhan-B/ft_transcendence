import { useEffect, useState } from "react";
import { useCountdown } from "../../hooks/game/useCountdown";

const REDIRECT_SECONDS = 5;

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
      <div className="modal-box text-center">
        <h3 className="text-3xl font-bold">{title}</h3>
        <p className="mt-4 opacity-80">Back to the lobby in {left}s</p>
        <progress
          className="progress progress-accent mt-2 w-full"
          value={left ?? REDIRECT_SECONDS}
          max={REDIRECT_SECONDS}
        />
        <div className="modal-action justify-center">
          <button type="button" className="btn btn-primary" onClick={onLeave}>
            Back now
          </button>
        </div>
      </div>
    </dialog>
  );
}
