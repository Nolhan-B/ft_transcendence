import { useState } from "react";
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

// Opponents are not named: the server only sends their ids
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
