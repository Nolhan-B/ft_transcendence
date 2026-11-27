import type { CSSProperties } from "react";

// A few big blurred cards, far behind the content: [color, left, top, angle]
const GHOST_CARDS: [string, string, string, string][] = [
  ["var(--color-accent)", "-4%", "18%", "-18deg"],
  ["var(--color-secondary)", "82%", "8%", "14deg"],
  ["var(--color-success)", "88%", "62%", "-10deg"],
  ["var(--color-neutral)", "6%", "70%", "22deg"],
];

// Background of the whole site: a radial gradient in the table color (lighter at the top,
// like a lamp over the table), slow light rays and some blurred cards. It is
// fixed behind the pages.
export function TableBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(circle_at_50%_25%,var(--table-1)_0%,var(--table-2)_45%,var(--table-3)_100%)] transition-[background] duration-500"
    >
      {/* Light rays from the top */}
      <div className="bg-rays absolute inset-0 opacity-60 [--rays-origin:50%_-10%] mask-[radial-gradient(ellipse_at_50%_0%,#000_10%,transparent_70%)]" />

      {GHOST_CARDS.map(([color, left, top, angle]) => (
        <div
          key={left + top}
          className="absolute aspect-56/87 w-64 rounded-[1.75rem] border-[10px] border-white/70 opacity-20 blur-[3px]"
          style={
            {
              left,
              top,
              rotate: angle,
              background: color,
            } as CSSProperties
          }
        >
          <div className="absolute inset-[30%] rotate-45 rounded-[22%] bg-white/80" />
        </div>
      ))}

      {/* Dark corners: the eye goes to the middle */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_55%,rgb(0_0_0/0.45)_100%)]" />
    </div>
  );
}
