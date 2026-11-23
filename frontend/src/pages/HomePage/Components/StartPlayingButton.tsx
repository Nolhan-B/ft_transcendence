import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

// Primary neon CTA button linking to the game lobby
export function StartPlayingButton({ children }: PropsWithChildren) {
  return (
    <div className="aura aura-dual self-start">
      <Link
        to="/play"
        className="btn btn-lg font-cyber border-0 bg-gradient-to-r from-[#00b8d9] via-[#9333ea] to-[#ff2a85] px-8 text-lg font-extrabold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_rgba(0,240,255,0.6)] active:scale-95"
      >
        {children}
      </Link>
    </div>
  );
}
