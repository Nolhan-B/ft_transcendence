import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "../../user/UserAvatar";
import { useAuth } from "../../../hooks/auth/useAuth";

// Right side of the navbar: sign-in / sign-up for a visitor, a dropdown with
// the avatar and the username for a connected user
export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  // Same width as the buttons: nothing jumps once the session is known
  if (loading) return <div className="skeleton h-10 w-10 sm:w-40" />;

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link to="/auth" className="btn btn-ghost text-white">
          Sign in
        </Link>
        <Link
          to="/auth?mode=register"
          className="btn btn-accent hidden sm:inline-flex"
        >
          Sign up
        </Link>
      </div>
    );
  }

  // A dropdown stays open while it has the focus: drop it after a choice
  function close() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  async function handleLogout() {
    close();
    await logout();
    navigate("/home");
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        aria-label="User menu"
        className="btn btn-ghost h-auto gap-3 rounded-full border-transparent p-1 shadow-none transition-transform duration-200 hover:scale-105 hover:border-transparent hover:bg-transparent active:scale-95 sm:pr-4"
      >
        {/* Ring around the avatar: the menu button is easy to spot */}
        <span className="inline-flex rounded-[30%] ring-2 ring-accent">
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatarUrl}
            size="sm"
            fullRounded={false}
          />
        </span>
        <span className="font-cyber hidden max-w-32 truncate text-sm font-bold tracking-wide sm:inline">
          {user.username}
        </span>
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="hidden h-4 w-4 sm:block"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
      <ul
        tabIndex={0}
        className="menu dropdown-content z-50 mt-3 w-52 rounded-box bg-base-200 p-2 shadow-xl"
      >
        <li className="menu-title font-cyber sm:hidden">{user.username}</li>
        <li>
          <Link
            to="/profile"
            className="btn btn-neutral w-full"
            onClick={close}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            Profile
          </Link>
        </li>
        <li className="mt-1">
          <Link
            to="/settings"
            className="btn btn-neutral w-full"
            onClick={close}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1 .26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
            Settings
          </Link>
        </li>
        <li className="mt-2">
          <button
            type="button"
            className="btn btn-error w-full"
            onClick={handleLogout}
          >
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
}
