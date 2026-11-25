import { Link } from "react-router-dom";
import { useBlocks } from "../../hooks/user/useBlocks";
import { UserAvatar } from "./UserAvatar";

// The users I blocked, each with an "Unblock" button
export function BlockedUsersSettings() {
  const { blocked, loading, busy, error, unblock } = useBlocks();

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Blocked users</h2>
        <p className="text-sm opacity-70">
          They cannot send you messages or friend requests. Block someone from
          their profile page.
        </p>

        {error && (
          <div role="alert" className="alert alert-error alert-soft">
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="skeleton h-12 w-full" />
        ) : blocked.length === 0 ? (
          <p className="text-sm opacity-50">You have not blocked anyone.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocked.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-box bg-black/20 p-2"
              >
                <UserAvatar
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                />
                <Link
                  to={`/users/${user.id}`}
                  className="link link-hover min-w-0 flex-1 truncate font-medium"
                >
                  {user.username}
                </Link>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={busy}
                  onClick={() => unblock(user.id)}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
