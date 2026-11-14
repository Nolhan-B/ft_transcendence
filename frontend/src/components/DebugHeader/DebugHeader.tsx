import { useContext, useState } from "react";
import {
  matchPath,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../hooks/auth/useAuth";
import { ChatContext } from "../../context/ChatContext";
import { GameContext } from "../../context/GameContext";
import type { Status } from "../../hooks/ws/useWebSocket";

// DEV ONLY. Rendered by MainLayout behind `import.meta.env.DEV`, so Vite
// strips it (and this file) from the production bundle.
//
// The contexts are read with useContext instead of useGame()/useChat(): a
// visitor has no provider mounted (RealtimeSession only wraps connected
// users), and those hooks throw in that case.

const STATUS_CLASS: Record<Status, string> = {
  open: "badge-success",
  connecting: "badge-warning",
  closed: "badge-error",
};

// Debug navigation table: keep in sync with router/router.tsx by hand.
// `path` may contain ":param" segments, filled from the inputs below.
const DEBUG_ROUTES: { path: string; title: string; access: string }[] = [
  { path: "/home", title: "Home", access: "public" },
  { path: "/rules", title: "Rules", access: "public" },
  { path: "/terms", title: "Terms", access: "public" },
  { path: "/privacy", title: "Privacy", access: "public" },
  { path: "/leaderboard", title: "Leaderboard", access: "public" },
  { path: "/users/:id", title: "User profile", access: "public" },
  { path: "/play", title: "Play (lobby)", access: "auth" },
  { path: "/play/rooms/:code", title: "Room", access: "auth" },
  { path: "/games/:id", title: "Game", access: "auth" },
  { path: "/games/:id/spectate", title: "Spectate", access: "auth" },
  { path: "/profile", title: "My profile", access: "auth" },
  { path: "/settings", title: "Settings", access: "auth" },
  { path: "/auth", title: "Sign-in / Sign-up", access: "visitor" },
];

// ":id" from "/games/:id" -> ["id"]
function paramsOf(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1));
}

// Fill ":param" segments with concrete values, encoded for the URL
function fillPath(path: string, values: Record<string, string>): string {
  return path
    .split("/")
    .map((segment) =>
      segment.startsWith(":")
        ? encodeURIComponent(values[segment.slice(1)]?.trim() ?? "")
        : segment,
    )
    .join("/");
}

function StatusBadge({ label, status }: { label: string; status?: Status }) {
  return (
    <span
      className={`badge badge-sm ${
        status ? STATUS_CLASS[status] : "badge-ghost"
      }`}
    >
      {label}: {status ?? "no provider"}
    </span>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <span className="whitespace-nowrap">
      <span className="opacity-60">{label}:</span>{" "}
      <span className="font-mono">
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </span>
    </span>
  );
}

export function DebugHeader() {
  const { user, loading, twoFactorPending, logout, refresh } = useAuth();
  const chat = useContext(ChatContext);
  const game = useContext(GameContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [navOpen, setNavOpen] = useState(false);

  // Route params are mirrored in the URL (?p_id=...) so they survive a reload.
  // When a field is empty, the current page's value is reused.
  const [searchParams, setSearchParams] = useSearchParams();
  const currentRoute = DEBUG_ROUTES.find(
    (route) => matchPath(route.path, location.pathname) !== null,
  );
  const currentMatch = currentRoute
    ? matchPath(currentRoute.path, location.pathname)
    : null;
  const paramNames = Array.from(
    new Set(DEBUG_ROUTES.flatMap((route) => paramsOf(route.path))),
  );

  function paramValue(name: string): string {
    const fromUrl = searchParams.get(`p_${name}`);
    if (fromUrl !== null) return fromUrl;
    return currentMatch?.params[name] ?? "";
  }

  function setParam(name: string, value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === "") next.delete(`p_${name}`);
        else next.set(`p_${name}`, value);
        return next;
      },
      { replace: true },
    );
  }

  function goTo(path: string) {
    const values = Object.fromEntries(
      paramNames.map((name) => [name, paramValue(name)]),
    );
    navigate(fillPath(path, values));
    setNavOpen(false);
  }

  const conversationCount = chat ? Object.keys(chat.conversations).length : 0;
  const messageCount = chat
    ? Object.values(chat.conversations).reduce(
        (total, messages) => total + messages.length,
        0,
      )
    : 0;

  async function handleLogout() {
    await logout();
    navigate("/home");
  }

  return (
    <div className="border-b border-base-300 bg-base-200 text-xs">
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-1.5">
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "▾" : "▸"} debug
        </button>

        <button
          type="button"
          className={`btn btn-xs ${navOpen ? "btn-primary" : ""}`}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((value) => !value)}
        >
          routes {navOpen ? "▴" : "▾"}
        </button>

        {/* Auth */}
        <StatusBadge
          label="auth"
          status={loading ? "connecting" : user ? "open" : "closed"}
        />
        {twoFactorPending && (
          <span className="badge badge-sm badge-info">2FA pending</span>
        )}
        <Field label="user" value={user?.username} />
        {open && <Field label="id" value={user?.id} />}
        {open && (
          <Field label="2FA" value={user ? user.twoFactorSecretEnabled : "—"} />
        )}

        {/* Game socket */}
        <StatusBadge label="game ws" status={game?.status} />
        <Field label="game" value={game?.gameId} />
        <Field label="room" value={game?.room?.code} />
        {open && game?.room && (
          <Field
            label="players"
            value={`${game.room.players.length}/${game.room.maxPlayers} (${game.room.players
              .map((player) => player.username)
              .join(", ")})`}
          />
        )}
        {open && game?.room && <Field label="mode" value={game.room.mode} />}
        {game?.error && (
          <span className="badge badge-sm badge-error">game: {game.error}</span>
        )}

        {/* Chat socket */}
        <StatusBadge label="chat ws" status={chat?.status} />
        <Field label="conv" value={conversationCount} />
        <Field label="msgs" value={messageCount} />
        {chat?.error && (
          <span className="badge badge-sm badge-error">chat: {chat.error}</span>
        )}

        {/* Navigation */}
        <Field label="route" value={location.pathname} />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => void refresh()}
          >
            refresh /me
          </button>
          {user && (
            <button
              type="button"
              className="btn btn-xs btn-error"
              onClick={() => void handleLogout()}
            >
              disconnect
            </button>
          )}
        </div>
      </div>

      {navOpen && (
        <div className="container mx-auto flex flex-col gap-2 border-t border-base-300 px-4 py-2">
          {/* One input per ":param" found in the table above */}
          {paramNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="opacity-60">params:</span>
              {paramNames.map((name) => (
                <label key={name} className="flex items-center gap-1">
                  <span className="font-mono opacity-60">:{name}</span>
                  <input
                    className="input input-xs w-40 font-mono"
                    value={paramValue(name)}
                    placeholder={name}
                    aria-label={`Value for route parameter ${name}`}
                    onChange={(event) => setParam(name, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-4">
            {DEBUG_ROUTES.map((route) => {
              const active = currentRoute?.path === route.path;
              return (
                <button
                  key={route.path}
                  type="button"
                  className={`btn btn-xs justify-start font-mono ${
                    active ? "btn-primary" : "btn-ghost"
                  }`}
                  title={`${route.title} (${route.access})`}
                  onClick={() => goTo(route.path)}
                >
                  <span className="badge badge-xs">{route.access}</span>
                  <span className="truncate">{route.path}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
