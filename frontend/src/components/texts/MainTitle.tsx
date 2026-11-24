export type MainTitleProps = {
  title: string;
};

// The four UNO colors, as a short striped underline
const STRIPES = ["bg-primary", "bg-accent", "bg-success", "bg-secondary"];

// Shared page header used across Leaderboard, Play, Room, Rules, and Settings
export function MainTitle({ title }: MainTitleProps) {
  return (
    <div className="mb-6 w-full">
      <h1 className="text-display text-3xl [overflow-wrap:anywhere] sm:text-4xl">
        {title}
      </h1>
      <div aria-hidden="true" className="mt-3 flex h-1.5 w-40 gap-1">
        {STRIPES.map((bg) => (
          <span key={bg} className={`flex-1 rounded-full ${bg}`} />
        ))}
      </div>
    </div>
  );
}
