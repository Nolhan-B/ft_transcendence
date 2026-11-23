import type { HTMLAttributes, ReactNode } from "react";

// Only theme colors (see styles/index.css), so the card follows the theme.
export type CardColor =
  "primary" | "secondary" | "accent" | "success" | "neutral";

// "classic": colored body, thick white border, dark central panel (auth page).
// "neon": dark body, glowing tube of the card color around the panel (game).
export type CardVariant = "classic" | "neon";

const COLOR_CLASSES: Record<CardColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  success: "bg-success",
  neutral: "bg-neutral",
};

// Neon look, per color: outer border and halo, then the inner tube.
// Full class names, so that Tailwind finds them.
const NEON_CLASSES: Record<CardColor, { card: string; tube: string }> = {
  primary: {
    card: "border-primary/70 shadow-[0_0_14px_-4px_var(--color-primary)]",
    tube: "border-primary text-primary shadow-[0_0_4cqw_var(--color-primary),inset_0_0_6cqw_var(--color-primary)]",
  },
  secondary: {
    card: "border-secondary/70 shadow-[0_0_14px_-4px_var(--color-secondary)]",
    tube: "border-secondary text-secondary shadow-[0_0_4cqw_var(--color-secondary),inset_0_0_6cqw_var(--color-secondary)]",
  },
  accent: {
    card: "border-accent/70 shadow-[0_0_14px_-4px_var(--color-accent)]",
    tube: "border-accent text-accent shadow-[0_0_4cqw_var(--color-accent),inset_0_0_6cqw_var(--color-accent)]",
  },
  success: {
    card: "border-success/70 shadow-[0_0_14px_-4px_var(--color-success)]",
    tube: "border-success text-success shadow-[0_0_4cqw_var(--color-success),inset_0_0_6cqw_var(--color-success)]",
  },
  // Wild cards and backs: a white tube, the content brings the colors
  neutral: {
    card: "border-neutral-content/40 shadow-[0_0_14px_-6px_var(--color-neutral-content)]",
    tube: "border-neutral-content/70 text-neutral-content shadow-[0_0_3cqw_var(--color-neutral-content),inset_0_0_4cqw_var(--color-neutral-content)]",
  },
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  color?: CardColor;
  variant?: CardVariant;
  children?: ReactNode;
}

// A single UNO card with real card proportions (56x87 mm).
// It is purely visual: positioning (fan, stack...) is up to the parent.
// The ratio never gives way to the content: the panel scrolls instead, and
// paddings / radius follow the card width (container query units).
export function Card({
  color = "primary",
  variant = "classic",
  children,
  className = "",
  ...rest
}: CardProps) {
  if (variant === "neon") {
    const neon = NEON_CLASSES[color];
    return (
      <div
        className={`card @container aspect-[56/87] min-h-0 overflow-hidden border-2 bg-base-300 ${neon.card} ${className}`}
        {...rest}
      >
        <div className="card-body min-h-0 p-[7cqw]">
          {/* The tube: positioned, so the content can pin corner indices */}
          <div
            className={`relative flex min-h-0 flex-1 flex-col rounded-[9cqw] border-[2cqw] ${neon.tube}`}
          >
            <div className="my-auto">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card @container aspect-[56/87] min-h-0 overflow-hidden border-8 border-primary-content shadow-2xl ${COLOR_CLASSES[color]} ${className}`}
      {...rest}
    >
      <div className="card-body min-h-0 p-[4cqw]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[10cqw] bg-base-300 px-[8cqw] py-[10cqw]">
          {/* my-auto centers without hiding the top when the panel scrolls */}
          <div className="my-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
