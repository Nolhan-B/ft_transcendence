import type { PropsWithChildren } from "react";

export function StartPlayingButton({ children }: PropsWithChildren) {
  return (
    <div className="aura aura-dual self-start">
      <button className="btn bg-secondary text-2xl text-secondary-content p-6">
        {children}
      </button>
    </div>
  );
}
