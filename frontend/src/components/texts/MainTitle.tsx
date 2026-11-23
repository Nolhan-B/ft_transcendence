export type MainTitleProps = {
  title: string;
};

// Shared cyberpunk page header used across Leaderboard, Play, Room, Rules, and Settings
export function MainTitle({ title }: MainTitleProps) {
  return (
    <div className="mb-4 w-full">
      {/* inline-block keeps the gradient bounded to the actual text width */}
      <h1 className="font-cyber inline-block bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#ff2a85] bg-clip-text text-2xl font-black uppercase tracking-wider text-transparent drop-shadow-[0_0_10px_rgba(0,240,255,0.2)] [overflow-wrap:anywhere] sm:text-3xl">
        {title}
      </h1>
      {/* Neon fade-out divider replacing the default flat DaisyUI divider */}
      <div
        aria-hidden="true"
        className="mt-3 h-[2px] w-full bg-gradient-to-r from-[#00f0ff]/80 via-[#a855f7]/50 to-transparent"
      />
    </div>
  );
}
