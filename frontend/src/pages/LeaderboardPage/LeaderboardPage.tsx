import { useEffect, useState } from "react";
import { MainTitle } from "../../components/texts/MainTitle";
import type { LeaderboardEntry } from "shared";
import { useAuth } from "../../hooks/auth/useAuth";
import { useNavigate } from "react-router-dom";

function Leaderboard() {
  const [error, setError] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate("/home");
  }

  async function fetchLeaderboard() {
    const res = await fetch("/api/user/leaderboard?limit=10", {
      credentials: "include",
    });
    if (!res.ok) {
      setError("Could not load the leaderboard.");
      return;
    }
    const data = await res.json();
    setLeaderboard(data.leaderboard);
  }

  async function fetchMyRank() {
    const res = await fetch("/api/user/leaderboard/me", {
      credentials: "include",
    });
    if (!res.ok) return; // 401 (pas connecté) ou 404 : on n'affiche rien
    setMyRank(await res.json());
  }

  useEffect(() => {
    fetchLeaderboard();
    fetchMyRank();
  }, [user]);

  return (
    <div className="overflow-x-auto mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-box border-2 border-base-content/10 bg-[color:color-mix(in_oklab,var(--color-base-100),var(--color-base-content)_7%)] bg-[image:radial-gradient(color-mix(in_oklab,var(--color-base-content)_10%,transparent)_1px,transparent_1px)] bg-[size:18px_18px] p-4 sm:p-8">
      {error ? (
        <div role="alert" className="alert alert-warning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{error}</span>
        </div>
      ) : (
        ""
      )}
      <table className="table">
        {/* head */}
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Elo</th>
          </tr>
        </thead>
        <tbody>
          {/* row 1 */}
          {!error &&
            leaderboard.map((leader, index) => (
              <tr className={user?.id !== leader.id ? "" : "bg-base-200"}>
                <th>{index + 1}</th>
                <td>{user?.id !== leader.id ? leader.username : "You"}</td>
                <td>{leader.elo}</td>
              </tr>
            ))}
          {myRank && myRank.rank > 10 && (
            <tr className="bg-base-200">
              <th>{myRank.rank}</th>
              <td>You</td>
              <td>{myRank.elo}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LeaderboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <MainTitle title="Leaderboard" />
      <Leaderboard />
    </div>
  );
}
