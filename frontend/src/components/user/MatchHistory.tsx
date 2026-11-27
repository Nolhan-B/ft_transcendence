import { useState } from "react";
import { Link } from "react-router-dom";
import type { Match } from "shared";

const PAGE_SIZE = 10;

interface Props {
  matches: Match[];
  userId: string;
}

function duration(match: Match): string {
  if (!match.endedAt) return "-";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(match.endedAt).getTime() -
        new Date(match.startedAt).getTime()) /
        1000,
    ),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// The players of a game in finishing order (the winner first, then the ones
// who finished, then the others), small and quiet. The profile owner is in
// bold; a real account links to its profile, a bot or a deleted one does not.
function Players({ match, userId }: { match: Match; userId: string }) {
  const place = (id: string) => {
    const index = match.ranking.indexOf(id);
    return index === -1 ? match.ranking.length : index;
  };
  const ordered = [...match.participants].sort(
    (a, b) => place(a.id) - place(b.id),
  );

  return (
    <ol className="flex flex-col text-xs leading-5 opacity-80">
      {ordered.map((p, i) => {
        const me = p.id === userId;
        const name = (
          <span
            className={`truncate ${me ? "font-semibold" : ""} ${p.deleted ? "italic opacity-60" : ""}`}
          >
            {p.username}
          </span>
        );
        return (
          <li key={p.id} className="flex max-w-40 items-baseline gap-1.5">
            <span className="w-3 shrink-0 text-right tabular-nums opacity-50">
              {i + 1}
            </span>
            {p.isBot || p.deleted || me ? (
              name
            ) : (
              <Link
                to={`/users/${p.id}`}
                className="link-hover truncate"
                title={`${p.username}'s profile`}
              >
                {name}
              </Link>
            )}
            {p.isBot && <span className="shrink-0 opacity-50">bot</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ELO won or lost in a ranked game, "-" in classic
function EloChange({ match, userId }: { match: Match; userId: string }) {
  const me = match.participants.find((p) => p.id === userId);
  if (me?.oldElo == null || me.newElo == null) return <>-</>;
  const delta = me.newElo - me.oldElo;
  return (
    <span
      className={`font-semibold ${delta >= 0 ? "text-success" : "text-error"}`}
      title={`${me.oldElo} → ${me.newElo}`}
    >
      {delta >= 0 ? `+${delta}` : delta}
    </span>
  );
}

export function MatchHistory({ matches, userId }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (matches.length === 0) {
    return (
      <div className="alert alert-info">
        <span>No game played yet.</span>
      </div>
    );
  }

  const shown = showAll ? matches : matches.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-box bg-base-200 shadow">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Result</th>
              <th>Place</th>
              <th>Players</th>
              <th>ELO</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((match) => {
              const won = match.winnerId === userId;
              const place = match.ranking.indexOf(userId) + 1;
              return (
                <tr key={match.id}>
                  <td>
                    {new Date(match.startedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className="badge badge-outline capitalize">
                      {match.mode}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${won ? "badge-success" : "badge-error"}`}
                    >
                      {won ? "Win" : "Loss"}
                    </span>
                  </td>
                  <td>
                    {place > 0 ? `${place} / ${match.players.length}` : "-"}
                  </td>
                  <td>
                    <Players match={match} userId={userId} />
                  </td>
                  <td>
                    <EloChange match={match} userId={userId} />
                  </td>
                  <td>{duration(match)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matches.length > PAGE_SIZE && (
        <button
          type="button"
          className="btn btn-ghost self-center"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show less" : `Show all (${matches.length})`}
        </button>
      )}
    </div>
  );
}
