import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

// Primary neon CTA button linking to the game lobby
export function StartPlayingButton({ children }: PropsWithChildren) {
  return (
    <div className="aura aura-dual self-start">
      <Link
        to="/play"
        className="btn btn-lg font-cyber border-0 bg-gradient-to-r from-secondary via-tertiary to-primary px-8 text-lg font-extrabold uppercase tracking-wider text-white shadow-[0_0_20px_color-mix(in_oklab,var(--color-tertiary)_45%,transparent)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_color-mix(in_oklab,var(--color-secondary)_60%,transparent)] active:scale-95"
      >
        {children}
      </Link>
    </div>
  );
}
