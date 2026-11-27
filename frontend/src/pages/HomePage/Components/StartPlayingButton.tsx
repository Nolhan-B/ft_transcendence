import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

// Main call to action: a big yellow button to the game lobby
export function StartPlayingButton({ children }: PropsWithChildren) {
  return (
    <div className="self-start">
      <Link to="/play" className="btn btn-accent btn-xl px-10 text-xl">
        {children}
      </Link>
    </div>
  );
}
