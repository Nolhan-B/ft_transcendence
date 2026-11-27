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

function unlockedOn(achievement: Achievement): string {
  if (!achievement.unlockedAt) return "Unlocked";
  return `Unlocked on ${new Date(achievement.unlockedAt).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  )}`;
}

// Grid of badges: colored when unlocked, grey with the progress otherwise
export function Achievements({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const count = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">
        Achievements
        <span className="ml-2 align-middle text-base font-semibold opacity-60">
          {count} / {achievements.length}
        </span>
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={`flex flex-col items-center gap-1 rounded-box border p-3 text-center ${
              a.unlocked
                ? "border-accent/60 bg-base-200 shadow"
                : "border-base-content/10 bg-base-200/50"
            }`}
            title={a.unlocked ? unlockedOn(a) : `${a.progress} / ${a.goal}`}
          >
            <span
              aria-hidden="true"
              className={`text-3xl ${a.unlocked ? "" : "opacity-30 grayscale"}`}
            >
              {ICONS[a.id]}
            </span>
            <span className={`font-semibold ${a.unlocked ? "" : "opacity-60"}`}>
              {a.title}
            </span>
            <span className="text-xs opacity-60">{a.description}</span>
            {a.unlocked ? (
              <span className="badge badge-accent badge-sm mt-1">
                {unlockedOn(a)}
              </span>
            ) : (
              <progress
                className="progress progress-accent mt-1 w-full"
                value={a.progress}
                max={a.goal}
                aria-label={`${a.progress} of ${a.goal}`}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
