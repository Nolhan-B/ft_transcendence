import { Link, useParams } from "react-router-dom";
import { UserAvatar } from "../../components/user/UserAvatar";
import { useAuth } from "../../hooks/auth/useAuth";
import { EditProfile } from "../../components/user/EditProfile";
import { BlockUserButton } from "../../components/user/BlockUserButton";
import { MatchHistory } from "../../components/user/MatchHistory";
import { MatchStats } from "../../components/user/MatchStats";
import { useMatchHistory } from "../../hooks/game/useMatchHistory";
import { Achievements } from "../../components/user/Achievements";
import { EloChart } from "../../components/user/EloChart";
import { useAchievements } from "../../hooks/game/useAchievements";
import { useProfile } from "../../hooks/user/useProfile";

// One page for both routes: /profile (my own) and /users/:id (anyone)
export function ProfilePage() {
  const { id: paramId } = useParams();
  const { user } = useAuth();
  const id = paramId ?? user?.id;
  const { profile, loading, error, reload } = useProfile(id);
  const isOwn = id !== undefined && id === user?.id;
  const history = useMatchHistory(id, isOwn);
  const achievements = useAchievements(id);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        role="alert"
        className="alert alert-error alert-vertical mx-auto max-w-2xl gap-6 border-4 border-error-content/20 p-10 text-center shadow-xl"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-20 w-20"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <div>
          <h2 className="text-3xl font-bold">Oops!</h2>
          <p className="mt-2 text-xl">{error ?? "User not found."}</p>
        </div>
        <Link to="/home" className="btn btn-neutral btn-lg">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-box border-2 border-base-content/10 bg-[color:color-mix(in_oklab,var(--color-base-100),var(--color-base-content)_7%)] bg-[image:radial-gradient(color-mix(in_oklab,var(--color-base-content)_10%,transparent)_1px,transparent_1px)] bg-[size:18px_18px] p-4 sm:p-8">
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body flex-row flex-wrap items-center gap-6">
          <UserAvatar
            username={profile.username}
            avatarUrl={profile.avatarUrl}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="card-title flex-wrap text-3xl [overflow-wrap:anywhere]">
              {profile.username}
              {isOwn && <span className="badge badge-primary">You</span>}
            </h1>
            <p className="text-sm opacity-70">
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          {isOwn && (
            <div className="ml-auto self-start">
              <EditProfile profile={profile} onSaved={reload} />
            </div>
          )}
          {/* Someone else's profile, while connected */}
          {!isOwn && user && (
            <div className="ml-auto self-start">
              <BlockUserButton profile={profile} />
            </div>
          )}
        </div>
      </div>

      <div className="stats stats-vertical bg-base-200 shadow sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">ELO</div>
          <div className="stat-value text-primary">{profile.elo}</div>
        </div>
      </div>

      {history.loading ? (
        <div className="skeleton h-40 w-full" />
      ) : history.error ? (
        <div role="alert" className="alert alert-error">
          <span>{history.error}</span>
        </div>
      ) : (
        <>
          <MatchStats matches={history.matches} userId={profile.id} />
          <EloChart matches={history.matches} userId={profile.id} />
          {achievements.achievements && (
            <Achievements achievements={achievements.achievements} />
          )}
          {achievements.error && (
            <div role="alert" className="alert alert-warning">
              <span>{achievements.error}</span>
            </div>
          )}
          <h2 className="text-2xl font-bold">Game history</h2>
          <MatchHistory matches={history.matches} userId={profile.id} />
        </>
      )}
    </div>
  );
}
