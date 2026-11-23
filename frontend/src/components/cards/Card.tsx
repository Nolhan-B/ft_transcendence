import type { HTMLAttributes, ReactNode } from "react";

// Only theme colors (see styles/index.css), so the card follows the theme.
export type CardColor =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "neutral";

// "classic": colored body, thick white border, dark central panel (auth page).
// "neon": solid opaque dark body with a crisp glowing tube (game & hero).
export type CardVariant = "classic" | "neon";

const COLOR_CLASSES: Record<CardColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  success: "bg-success",
  neutral: "bg-neutral",
};

// Neon look per color: crisp border and inner tube on a fully opaque surface
// so overlapping cards in a hand stay cleanly separated.
const NEON_CLASSES: Record<CardColor, { card: string; tube: string }> = {
  primary: {
    card: "border-primary/80 shadow-[0_0_16px_-4px_var(--color-primary)]",
    tube: "border-primary text-primary shadow-[0_0_4cqw_var(--color-primary),inset_0_0_5cqw_var(--color-primary)]",
  },
  secondary: {
    card: "border-secondary/80 shadow-[0_0_16px_-4px_var(--color-secondary)]",
    tube: "border-secondary text-secondary shadow-[0_0_4cqw_var(--color-secondary),inset_0_0_5cqw_var(--color-secondary)]",
  },
  accent: {
    card: "border-accent/80 shadow-[0_0_16px_-4px_var(--color-accent)]",
    tube: "border-accent text-accent shadow-[0_0_4cqw_var(--color-accent),inset_0_0_5cqw_var(--color-accent)]",
  },
  success: {
    card: "border-success/80 shadow-[0_0_16px_-4px_var(--color-success)]",
    tube: "border-success text-success shadow-[0_0_4cqw_var(--color-success),inset_0_0_5cqw_var(--color-success)]",
  },
  // Wild cards and backs: bright white tube, the content brings the colors
  neutral: {
    card: "border-neutral-content/45 shadow-[0_0_14px_-6px_var(--color-neutral-content)]",
    tube: "border-neutral-content/75 text-neutral-content shadow-[0_0_3cqw_var(--color-neutral-content),inset_0_0_4cqw_var(--color-neutral-content)]",
  },
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  color?: CardColor;
  variant?: CardVariant;
  children?: ReactNode;
}

// A single card with real card proportions (56x87 mm).
// It is purely visual: positioning (fan, stack...) is up to the parent.
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
        className={`card @container relative aspect-[56/87] min-h-0 overflow-hidden border-2 bg-base-300 ${neon.card} ${className}`}
        {...rest}
      >
        <div className="card-body min-h-0 p-[7cqw]">
          {/* Solid opaque inner tube so stacked cards never bleed visually */}
          <div
            className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[9cqw] border-[2cqw] bg-base-300 ${neon.tube}`}
          >
            <div className="my-auto">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card @container aspect-56/87 min-h-0 overflow-hidden border-8 border-primary-content shadow-2xl ${COLOR_CLASSES[color]} ${className}`}
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
