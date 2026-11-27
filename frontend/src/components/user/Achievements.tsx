import type { Achievement, AchievementId } from "shared";

const ICONS: Record<AchievementId, string> = {
  first_win: "🏆",
  games_10: "🃏",
  games_50: "🎖️",
  streak_5: "🔥",
  full_table_win: "👑",
  first_ranked_win: "⚔️",
  elo_1200: "⭐",
  beat_a_bot: "🤖",
};

// Short date of the unlock ("Mar 3"), or nothing (unlocked outside a game)
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Tile({ achievement: a }: { achievement: Achievement }) {
  const date = shortDate(a.unlockedAt);
  return (
    <li
      className={`flex items-center gap-3 rounded-box p-3 ${
        a.unlocked
          ? "bg-base-200 ring-1 ring-accent/40"
          : "bg-base-200/40 ring-1 ring-base-content/5"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-full text-2xl ${
          a.unlocked ? "bg-accent/20" : "bg-base-300 opacity-40 grayscale"
        }`}
      >
        {ICONS[a.id]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate font-semibold ${a.unlocked ? "" : "opacity-50"}`}
          >
            {a.title}
          </span>
          {a.unlocked ? (
            <span
              className="shrink-0 text-xs text-accent"
              title={
                a.unlockedAt
                  ? new Date(a.unlockedAt).toLocaleString()
                  : undefined
              }
            >
              ✓{date && ` ${date}`}
            </span>
          ) : (
            <span className="shrink-0 text-xs tabular-nums opacity-50">
              {a.progress}/{a.goal}
            </span>
          )}
        </div>
        <span
          className={`truncate text-xs ${a.unlocked ? "opacity-70" : "opacity-40"}`}
        >
          {a.description}
        </span>
        {!a.unlocked && (
          <div
            className="mt-1 h-1 overflow-hidden rounded-full bg-base-300"
            role="progressbar"
            aria-valuenow={a.progress}
            aria-valuemax={a.goal}
            aria-label={`${a.title}: ${a.progress} of ${a.goal}`}
          >
            <div
              className="h-full rounded-full bg-accent/60"
              style={{ width: `${(a.progress / a.goal) * 100}%` }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

// Badges, the unlocked ones first
export function Achievements({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const count = achievements.filter((a) => a.unlocked).length;
  const sorted = [
    ...achievements.filter((a) => a.unlocked),
    ...achievements.filter((a) => !a.unlocked),
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2 text-2xl font-bold">
        Achievements
        <span className="text-sm font-semibold opacity-50">
          {count} of {achievements.length}
        </span>
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
        {sorted.map((a) => (
          <Tile key={a.id} achievement={a} />
        ))}
      </ul>
    </section>
  );
}
