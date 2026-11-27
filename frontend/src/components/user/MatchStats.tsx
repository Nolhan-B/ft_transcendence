import type { Match } from "shared";

interface Props {
  matches: Match[];
  userId: string;
}

// Numbers computed from the history (newest first)
function computeStats(matches: Match[], userId: string) {
  const played = matches.length;
  const wins = matches.filter((m) => m.winnerId === userId).length;
  const winRate = played === 0 ? 0 : Math.round((wins / played) * 100);

  let streak = 0;
  for (const match of matches) {
    if (match.winnerId !== userId) break;
    streak++;
  }

  return { played, wins, losses: played - wins, winRate, streak };
}

export function MatchStats({ matches, userId }: Props) {
  const { played, wins, losses, winRate, streak } = computeStats(
    matches,
    userId,
  );

  return (
    <div className="stats stats-vertical w-full bg-base-200 shadow sm:stats-horizontal">
      <div className="stat">
        <div className="stat-title">Games played</div>
        <div className="stat-value">{played}</div>
        <div className="stat-desc">
          {wins} won · {losses} lost
        </div>
      </div>

      <div className="stat">
        <div className="stat-title">Win rate</div>
        <div className="stat-value text-primary">{winRate}%</div>
        <progress
          className="progress progress-primary mt-2 w-full"
          value={winRate}
          max={100}
        />
      </div>

      <div className="stat">
        <div className="stat-title">Win streak</div>
        <div className="stat-value text-accent">{streak}</div>
        <div className="stat-desc">in a row</div>
      </div>
    </div>
  );
}
