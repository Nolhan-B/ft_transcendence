import type { ReactNode } from "react";
import type { CardValue } from "shared";
import snsLogo from "../../assets/images/sns-logo.svg?url";

// Neon glow of the text and icons, in the color of the card (currentColor).
// Sized with the card width (container query units).
const TEXT_GLOW = "[text-shadow:0_0_3cqw_currentColor,0_0_8cqw_currentColor]";
const ICON_GLOW = "drop-shadow-[0_0_2cqw_currentColor]";

// The four colors, for the wild cards
const WILD_COLORS = [
  "bg-primary shadow-primary",
  "bg-accent shadow-accent",
  "bg-success shadow-success",
  "bg-secondary shadow-secondary",
];

// Icons drawn as neon tubes: a stroke of the current color, no fill
function Icon({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${ICON_GLOW} ${className}`}
    >
      {children}
    </svg>
  );
}

function SkipIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18 18 6" />
    </Icon>
  );
}

function ReverseIcon({ className }: { className: string }) {
  return (
    <Icon className={className}>
      <path d="M4 9h13l-4-4M20 15H7l4 4" />
    </Icon>
  );
}

// Text or icon of a value, at a given size
function Value({ value, small }: { value: CardValue; small: boolean }) {
  const icon = small ? "w-[18cqw]" : "w-[50cqw]";
  if (value === "skip") return <SkipIcon className={icon} />;
  if (value === "reverse") return <ReverseIcon className={icon} />;
  const text: Partial<Record<CardValue, string>> = {
    draw2: "+2",
    wild: "W",
    wild_draw4: "+4",
  };
  return (
    <span
      className={`${small ? "text-[17cqw]" : "text-[44cqw]"} leading-none font-black ${TEXT_GLOW}`}
    >
      {text[value] ?? value}
    </span>
  );
}

// Face of a card: the value in the middle and in two opposite corners, so it
// stays readable when the cards overlap in a hand
export function CardFace({ value }: { value: CardValue }) {
  const wild = value === "wild" || value === "wild_draw4";
  return (
    <>
      <span className="absolute left-[5cqw] top-[4cqw] flex">
        <Value value={value} small />
      </span>
      <span className="absolute right-[5cqw] bottom-[4cqw] flex rotate-180">
        <Value value={value} small />
      </span>

      <div className="flex flex-col items-center justify-center gap-[6cqw]">
        <Value value={value} small={false} />
        {/* Wild: the four colors it can turn into, as small glowing lights */}
        {wild && (
          <div className="flex gap-[4cqw]" aria-hidden="true">
            {WILD_COLORS.map((bg) => (
              <span
                key={bg}
                className={`size-[7cqw] rounded-full shadow-[0_0_3cqw] ${bg}`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Back of a card: tilted SNS neon emblem scaled to the card width
export function CardBack() {
  return (
    <img
      src={snsLogo}
      alt="SNS"
      draggable={false}
      className="mx-auto w-[74cqw] -rotate-12 select-none drop-shadow-[0_0_3cqw_color-mix(in_oklab,var(--color-secondary)_45%,transparent)]"
    />
  );
}
