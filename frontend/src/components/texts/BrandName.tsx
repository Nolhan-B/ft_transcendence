type NameSize = "sm" | "lg";

// Full class names so that Tailwind can find them
const SIZES: Record<NameSize, string> = {
  sm: "text-base tracking-[0.12em] [word-spacing:0.25em]",
  lg: "text-xl tracking-[0.18em] [word-spacing:0.35em] min-[400px]:text-2xl sm:text-4xl sm:tracking-[0.22em] sm:[word-spacing:0.45em]",
};

interface Props {
  size?: NameSize;
  className?: string;
}

// Name of the site, written as three words: SORRY NOT SORRY, the middle one
// in yellow. Same text as WEBSITE_NAME for screen readers.
export function BrandName({ size = "lg", className = "" }: Props) {
  return (
    <span
      aria-label="SorryNotSorry"
      className={`font-black whitespace-nowrap text-white uppercase [text-shadow:0_3px_0_rgb(0_0_0/0.35)] ${SIZES[size]} ${className}`}
    >
      <span aria-hidden="true">
        Sorry <span className="text-accent">Not</span> Sorry
      </span>
    </span>
  );
}
