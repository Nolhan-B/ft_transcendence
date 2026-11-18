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
  xs: "w-10 text-sm border-2",
  sm: "w-12 short:w-9 text-lg short:text-sm border-4 short:border-2",
  md: "w-20 short:w-14 text-3xl short:text-xl border-4 short:border-2",
  lg: "w-24 short:w-16 text-4xl short:text-2xl border-8 short:border-4",
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
  const classes = `flex shrink-0 aspect-[56/87] items-center justify-center rounded-box font-black shadow-lg ${SIZES[size]} ${face}`;
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
