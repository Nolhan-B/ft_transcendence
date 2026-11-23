export type MainTitleProps = {
  title: string;
};

// Shared cyberpunk page header used across Leaderboard, Play, Room, Rules, and Settings
export function MainTitle({ title }: MainTitleProps) {
  return (
    <div className="mb-4 w-full">
      {/* inline-block keeps the gradient bounded to the actual text width */}
      <h1 className="font-cyber inline-block bg-gradient-to-r from-secondary via-tertiary to-primary bg-clip-text text-2xl font-black uppercase tracking-wider text-transparent drop-shadow-[0_0_10px_color-mix(in_oklab,var(--color-secondary)_20%,transparent)] [overflow-wrap:anywhere] sm:text-3xl">
        {title}
      </h1>
      {/* Neon fade-out divider replacing the default flat DaisyUI divider */}
      <div
        aria-hidden="true"
        className="mt-3 h-[2px] w-full bg-gradient-to-r from-secondary/80 via-tertiary/50 to-transparent"
      />
    </div>
  );
}
