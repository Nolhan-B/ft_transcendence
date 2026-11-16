import type { CardColor, CardValue } from "shared";

// Card colors from the daisyUI theme
const COLORS: Record<CardColor, string> = {
  red: "bg-primary text-primary-content",
  blue: "bg-secondary text-secondary-content",
  yellow: "bg-accent text-accent-content",
  green: "bg-success text-success-content",
  wild: "bg-neutral text-neutral-content",
};

const SYMBOLS: Partial<Record<CardValue, string>> = {
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild_draw4: "+4",
};

const SIZES = {
  sm: "w-12 text-lg border-4",
  md: "w-20 text-3xl border-4",
  lg: "w-24 text-4xl border-8",
};

interface Props {
  color?: CardColor;
  value?: CardValue;
  faceDown?: boolean;
  size?: keyof typeof SIZES;
  // Makes the card a button
  onClick?: () => void;
  disabled?: boolean;
}

// A UNO card (basic version: color, value and nothing else)
export function PlayingCard({
  color = "wild",
  value,
  faceDown = false,
  size = "md",
  onClick,
  disabled = false,
}: Props) {
  const face = faceDown
    ? "bg-base-300 text-base-content border-base-content/30"
    : `${COLORS[color]} border-primary-content`;
  const classes = `flex aspect-[56/87] items-center justify-center rounded-box font-black shadow-lg ${SIZES[size]} ${face}`;
  const content = faceDown ? (
    <span className="text-[0.5em] tracking-widest">UNO</span>
  ) : (
    (SYMBOLS[value as CardValue] ?? value)
  );

  if (!onClick) return <div className={classes}>{content}</div>;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${classes} cursor-pointer transition-transform hover:-translate-y-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0`}
    >
      {content}
    </button>
  );
}
