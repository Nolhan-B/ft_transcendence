import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function StartPlayingButton({ children }: PropsWithChildren) {
  return (
    <div className="aura aura-dual self-start">
      <Link
        to="/play"
        className="btn bg-secondary text-2xl text-secondary-content p-6"
      >
        {children}
      </Link>
    </div>
  );
}
