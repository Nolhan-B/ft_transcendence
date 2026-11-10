import type { HTMLAttributes, ReactNode } from "react";

// Only theme colors (see styles/index.css), so the card follows the theme.
export type CardColor = "primary" | "secondary" | "accent" | "success";

const COLOR_CLASSES: Record<CardColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  success: "bg-success",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  color?: CardColor;
  children?: ReactNode;
}

// A single UNO card: colored body, thick white border, real card proportions
// (56x87 mm) and a dark central panel holding the content.
// It is purely visual: positioning (fan, stack...) is up to the parent.
// The ratio never gives way to the content: the panel scrolls instead, and
// paddings / radius follow the card width (container query units).
export function Card({
  color = "primary",
  children,
  className = "",
  ...rest
}: CardProps) {
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
