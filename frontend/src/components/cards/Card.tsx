import type { HTMLAttributes, ReactNode } from "react";
import { NATIVE_H, NATIVE_W } from "./skins";

// Only theme colors (see styles/index.css), so the card follows the theme.
// "neutral": wild cards and card backs (see components/game/cards.ts)
export type CardColor =
  "primary" | "secondary" | "accent" | "success" | "neutral";

// "classic": colored body, thick white border, dark central panel that can
// hold anything (the forms of the auth page).
// "game": a game card. The content (CardFace / CardBack) is drawn by the
// card skin chosen in the settings.
export type CardVariant = "classic" | "game";

const COLOR_CLASSES: Record<CardColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  success: "bg-success",
  neutral: "bg-neutral",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  color?: CardColor;
  variant?: CardVariant;
  children?: ReactNode;
}

// A single UNO card with real card proportions (56x87 mm).
// It is purely visual: positioning (fan, stack...) is up to the parent.
// Border, radius and content follow the card width (container query units).
export function Card({
  color = "primary",
  variant = "classic",
  children,
  className = "",
  style,
  ...rest
}: CardProps) {
  if (variant === "game") {
    // The skin draws the card at its native size; it is scaled to the width
    // of this box (100cqw / NATIVE_W, as a number: tan(atan2()) turns the
    // ratio of two lengths into a plain number)
    return (
      <div
        className={`@container relative aspect-56/87 min-h-0 rounded-[8%/5.2%] select-none ${className}`}
        style={style}
        {...rest}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: NATIVE_W,
            height: NATIVE_H,
            scale: `tan(atan2(100cqw, ${NATIVE_W}px))`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card @container aspect-56/87 min-h-0 overflow-hidden border-8 border-white shadow-2xl ${COLOR_CLASSES[color]} ${className}`}
      style={style}
      {...rest}
    >
      {/* Light diagonal stripes behind the panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.1)_0_14px,transparent_14px_28px)]"
      />
      <div className="card-body relative min-h-0 p-[4cqw]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[10cqw] bg-base-300/90 px-[8cqw] py-[10cqw] shadow-[inset_0_2px_12px_rgb(0_0_0/0.4)] backdrop-blur-sm">
          {/* my-auto centers without hiding the top when the panel scrolls */}
          <div className="my-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
