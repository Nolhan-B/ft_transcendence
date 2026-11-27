import type { Match } from "shared";

interface Props {
  matches: Match[];
  userId: string;
}

interface Point {
  elo: number;
  // Date of the game that gave this ELO (null: the ELO before the first one)
  date: string | null;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_X = 8;
const PAD_Y = 16;

// The ELO of the player after each ranked game, oldest first, starting with
// the ELO before the first one
function eloPoints(matches: Match[], userId: string): Point[] {
  const ranked = matches
    .map((match) => ({
      match,
      me: match.participants.find((p) => p.id === userId),
    }))
    .filter(({ me }) => me?.oldElo != null && me.newElo != null)
    .sort(
      (a, b) =>
        Date.parse(a.match.endedAt ?? a.match.startedAt) -
        Date.parse(b.match.endedAt ?? b.match.startedAt),
    );
  if (ranked.length === 0) return [];
  return [
    { elo: ranked[0].me!.oldElo!, date: null },
    ...ranked.map(({ match, me }) => ({
      elo: me!.newElo!,
      date: match.endedAt ?? match.startedAt,
    })),
  ];
}

// ELO over the ranked games: a line, a dot per game (hover: ELO and date)
export function EloChart({ matches, userId }: Props) {
  const points = eloPoints(matches, userId);

  if (points.length === 0) {
    return (
      <p className="text-sm opacity-60">
        Play ranked games to see the ELO progress here.
      </p>
    );
  }

  const elos = points.map((p) => p.elo);
  // At least 40 points of range, so a flat line stays in the middle
  const mid = (Math.max(...elos) + Math.min(...elos)) / 2;
  const half = Math.max(20, (Math.max(...elos) - Math.min(...elos)) / 2);
  const low = Math.floor(mid - half);
  const high = Math.ceil(mid + half);
  const x = (i: number) =>
    points.length === 1
      ? WIDTH / 2
      : PAD_X + (i * (WIDTH - 2 * PAD_X)) / (points.length - 1);
  const y = (elo: number) =>
    PAD_Y + ((high - elo) * (HEIGHT - 2 * PAD_Y)) / (high - low);
  const line = points.map((p, i) => `${x(i)},${y(p.elo)}`).join(" ");
  const last = points[points.length - 1].elo;
  const total = last - points[0].elo;

  return (
    <figure className="flex flex-col gap-2 rounded-box bg-base-200 p-4 shadow">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">ELO progress</span>
        <span className="opacity-70">
          {points.length - 1} ranked game{points.length > 2 ? "s" : ""} ·{" "}
          <span className={total >= 0 ? "text-success" : "text-error"}>
            {total >= 0 ? `+${total}` : total}
          </span>
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-2 text-xs opacity-60">
          <span>{high}</span>
          <span>{low}</span>
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full text-primary"
          role="img"
          aria-label={`ELO from ${points[0].elo} to ${last}`}
        >
          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.elo)}
              r={4}
              fill="currentColor"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {p.date
                  ? `${p.elo} ELO · ${new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : `${p.elo} ELO before the first ranked game`}
              </title>
            </circle>
          ))}
        </svg>
      </div>
    </figure>
  );
}
