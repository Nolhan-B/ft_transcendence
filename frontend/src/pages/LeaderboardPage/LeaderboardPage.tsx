import { MainTitle } from "../../components/texts/MainTitle";

function Leaderboard() {
  return (
    <div className="overflow-x-auto mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-box border-2 border-base-content/10 bg-[color:color-mix(in_oklab,var(--color-base-100),var(--color-base-content)_7%)] bg-[image:radial-gradient(color-mix(in_oklab,var(--color-base-content)_10%,transparent)_1px,transparent_1px)] bg-[size:18px_18px] p-4 sm:p-8">
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
          <tr className="bg-base-200">
            <th>1</th>
            <td>You</td>
            <td>999</td>
          </tr>
          {/* row 2 */}
          <tr>
            <th>2</th>
            <td>template_user</td>
            <td>881</td>
          </tr>
          {/* row 3 */}
          <tr>
            <th>3</th>
            <td>template_user</td>
            <td>767</td>
          </tr>
          {/* row 3 */}
          <tr>
            <th>4</th>
            <td>template_user</td>
            <td>767</td>
          </tr>
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
