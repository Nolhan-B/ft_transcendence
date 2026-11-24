type LogoSize = "sm" | "md" | "lg" | "xl";

// Height of the mark and size of the letters. Full class names so that
// Tailwind can find them.
const SIZES: Record<LogoSize, { box: string; card: string; letter: string }> = {
  sm: {
    box: "h-9 w-12",
    card: "w-6 border-2 rounded-md p-px",
    letter: "text-[0.6rem]",
  },
  md: {
    box: "h-12 w-16",
    card: "w-8 border-2 rounded-lg p-0.5",
    letter: "text-xs",
  },
  lg: {
    box: "h-28 w-36",
    card: "w-18 border-4 rounded-xl p-1",
    letter: "text-xl",
  },
  xl: {
    box: "h-36 w-48 sm:h-44 sm:w-56",
    card: "w-22 sm:w-28 border-[5px] rounded-2xl p-1.5",
    letter: "text-2xl sm:text-3xl",
  },
};

// The three cards of the mark: letter, color and how it leans
const CARDS = [
  { letter: "S", bg: "bg-primary", turn: "-rotate-16 -translate-x-[38%]" },
  { letter: "N", bg: "bg-accent text-ink", turn: "-translate-y-[6%]" },
  { letter: "S", bg: "bg-secondary", turn: "rotate-16 translate-x-[38%]" },
];

interface Props {
  size?: LogoSize;
  className?: string;
}

// Logo of the site: three cards fanned out like a hand. Each card shows its
// letter in the top-left corner, like the index of a real card, so the fan
// reads S N S
export function BrandLogo({ size = "md", className = "" }: Props) {
  const { box, card, letter } = SIZES[size];
  return (
    <span
      role="img"
      aria-label="SNS"
      className={`relative inline-grid place-items-center select-none ${box} ${className}`}
    >
      {CARDS.map(({ letter: char, bg, turn }, i) => (
        <span
          key={i}
          className={`col-start-1 row-start-1 grid aspect-2/3 origin-bottom place-items-start border-white text-white shadow-[0_4px_10px_rgb(0_0_0/0.35)] ${bg} ${turn} ${card}`}
        >
          <span className={`leading-none font-black ${letter}`}>{char}</span>
        </span>
      ))}
    </span>
  );
}
