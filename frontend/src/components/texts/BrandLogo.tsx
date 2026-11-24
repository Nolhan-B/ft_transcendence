import { useId } from "react";

type LogoSize = "sm" | "md" | "lg" | "xl";

// Height of the mark (its width follows the drawing). Full class names so
// that Tailwind can find them.
const SIZES: Record<LogoSize, string> = {
  sm: "h-9",
  md: "h-12",
  lg: "h-28",
  xl: "h-36 sm:h-44",
};

// The three cards, from the back to the front: letter, gradient (light to
// dark), color of the letter and how much the card turns around the pivot
const CARDS = [
  { letter: "S", from: "#ff7a6b", to: "#c62828", ink: "#ffffff", angle: -20 },
  { letter: "N", from: "#ffe27a", to: "#f2a900", ink: "#3a2a00", angle: 0 },
  { letter: "S", from: "#6cb8ff", to: "#1559c0", ink: "#ffffff", angle: 20 },
];

// Card size and position in the drawing, and the point the fan turns around
// (below the cards, like a hand holding them)
const CARD = { x: 76, y: 22, w: 68, h: 104, r: 11, edge: 5 };
const PIVOT = { x: 110, y: 205 };

interface Props {
  size?: LogoSize;
  className?: string;
}

// Logo of the site: three cards fanned out like a hand. Each card shows its
// letter in the visible top-left corner, like the index of a real card, so
// the fan reads S N S.
export function BrandLogo({ size = "md", className = "" }: Props) {
  // Several logos can be on the same page: their SVG ids must not collide
  const id = useId().replace(/:/g, "");
  const inner = {
    x: CARD.x + CARD.edge,
    y: CARD.y + CARD.edge,
    w: CARD.w - 2 * CARD.edge,
    h: CARD.h - 2 * CARD.edge,
  };

  return (
    <svg
      role="img"
      aria-label="SNS"
      viewBox="8 12 204 140"
      className={`inline-block w-auto shrink-0 overflow-visible select-none ${SIZES[size]} ${className}`}
    >
      <defs>
        {CARDS.map(({ from, to }, i) => (
          <linearGradient
            key={i}
            id={`${id}-g${i}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        ))}
        {/* Light diagonal stripes over the colored body */}
        <pattern
          id={`${id}-stripes`}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="12" fill="#ffffff" opacity="0.1" />
        </pattern>
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            floodColor="#000000"
            floodOpacity="0.35"
          />
        </filter>
        <clipPath id={`${id}-clip`}>
          <rect
            x={inner.x}
            y={inner.y}
            width={inner.w}
            height={inner.h}
            rx={CARD.r - 4}
          />
        </clipPath>
      </defs>

      {CARDS.map(({ letter, ink, angle }, i) => (
        <g
          key={i}
          transform={`rotate(${angle} ${PIVOT.x} ${PIVOT.y})`}
          filter={`url(#${id}-shadow)`}
        >
          {/* White edge, then the colored body with its stripes */}
          <rect
            x={CARD.x}
            y={CARD.y}
            width={CARD.w}
            height={CARD.h}
            rx={CARD.r}
            fill="#ffffff"
          />
          <g clipPath={`url(#${id}-clip)`}>
            <rect
              x={inner.x}
              y={inner.y}
              width={inner.w}
              height={inner.h}
              fill={`url(#${id}-g${i})`}
            />
            <rect
              x={inner.x}
              y={inner.y}
              width={inner.w}
              height={inner.h}
              fill={`url(#${id}-stripes)`}
            />
          </g>

          {/* Index: the letter and a small diamond, in the top-left corner */}
          <text
            x={inner.x + 6}
            y={inner.y + 32}
            fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
            fontSize="34"
            fontWeight="900"
            fill={ink}
          >
            {letter}
          </text>
          <rect
            x={inner.x + 11}
            y={inner.y + 40}
            width="9"
            height="9"
            rx="1.5"
            fill={ink}
            opacity="0.85"
            transform={`rotate(45 ${inner.x + 15.5} ${inner.y + 44.5})`}
          />
        </g>
      ))}
    </svg>
  );
}
