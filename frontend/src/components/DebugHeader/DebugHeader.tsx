import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  matchPath,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../hooks/auth/useAuth";
import { ChatContext } from "../../context/ChatContext";
import type { ChatContextValue } from "../../context/ChatContext";
import { GameContext } from "../../context/GameContext";
import type { GameContextValue } from "../../context/GameContext";
import type { Status } from "../../hooks/ws/useWebSocket";

// DEV ONLY. Rendered by MainLayout behind `import.meta.env.DEV`, so Vite
// strips it (and this file) from the production bundle.
//
// The contexts are read with useContext instead of useGame()/useChat(): a
// visitor has no provider mounted (RealtimeSession only wraps connected
// users), and those hooks throw in that case.
//
// Layout of this file:
//   1. constants and types
//   2. pure helpers
//   3. UI primitives
//   4. hooks (websocket log, viewport, render count)
//   5. sections (one per debug panel)
//   6. the DebugHeader shell

// ============================================================
// 1. CONSTANTS AND TYPES
// ============================================================

const STATUS_CLASS: Record<Status, string> = {
  open: "badge-success",
  connecting: "badge-warning",
  closed: "badge-error",
};

// Debug navigation table: keep in sync with router/router.tsx by hand.
// `path` may contain ":param" segments, filled from the inputs in RoutesSection.
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

// Users created by `make seed`, resolved to their ids on demand.
const SEED_USERS = ["alice", "bob", "charlie"];

const MAX_EVENTS = 50;

type Section = "routes" | "events" | "friends" | "actions" | "state";

type WsEvent = {
  id: number;
  direction: "in" | "out";
  url: string;
  payload: string;
  at: string;
};

type TrackedSocket = { url: string; socket: WebSocket };

// ============================================================
// 2. PURE HELPERS
// ============================================================

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

function short(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "failed";
}

// ============================================================
// 3. UI PRIMITIVES
// ============================================================

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

// One collapsible panel under the status bar.
function SectionPanel({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto flex flex-col gap-2 border-t border-base-300 px-4 py-2">
      {children}
    </div>
  );
}

// ============================================================
// 4. HOOKS
// ============================================================

// The sockets live in a ref inside useWebSocket, which this file must not
// touch. In dev we wrap window.WebSocket to observe them instead. Only
// "/api/" sockets are recorded, so Vite's HMR socket stays out of the log.
function useWsEventLog() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const socketsRef = useRef<TrackedSocket[]>([]);
  const nextEventId = useRef(0);

  const pushEvent = useCallback(
    (direction: "in" | "out", url: string, payload: string) => {
      const event: WsEvent = {
        id: nextEventId.current++,
        direction,
        url,
        payload,
        at: new Date().toLocaleTimeString(),
      };
      setEvents((all) => [event, ...all].slice(0, MAX_EVENTS));
    },
    [],
  );

  useEffect(() => {
    const Original = window.WebSocket;
    const sockets = socketsRef.current;

    function Patched(
      this: unknown,
      url: string | URL,
      protocols?: string | string[],
    ) {
      const socket = new Original(url, protocols);
      const href = String(url);
      if (href.includes("/api/")) {
        sockets.push({ url: href, socket });
        socket.addEventListener("message", (event) => {
          pushEvent("in", href, String(event.data));
        });
        const send = socket.send.bind(socket);
        socket.send = (data: Parameters<WebSocket["send"]>[0]) => {
          pushEvent("out", href, String(data));
          return send(data);
        };
      }
      return socket;
    }

    // useWebSocket reads WebSocket.OPEN, so the statics must survive the swap.
    Object.assign(Patched, {
      CONNECTING: Original.CONNECTING,
      OPEN: Original.OPEN,
      CLOSING: Original.CLOSING,
      CLOSED: Original.CLOSED,
    });
    Patched.prototype = Original.prototype;
    window.WebSocket = Patched as unknown as typeof WebSocket;

    return () => {
      window.WebSocket = Original;
      socketsRef.current = [];
    };
  }, [pushEvent]);

  return {
    events,
    clearEvents: () => setEvents([]),
    socketsRef,
  };
}

// Tailwind's breakpoint currently in effect, for responsive debugging.
function useViewport() {
  const [viewport, setViewport] = useState("");

  useEffect(() => {
    function measure() {
      const width = window.innerWidth;
      const label =
        width >= 1536
          ? "2xl"
          : width >= 1280
            ? "xl"
            : width >= 1024
              ? "lg"
              : width >= 768
                ? "md"
                : width >= 640
                  ? "sm"
                  : "xs";
      setViewport(`${label} (${width}px)`);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return viewport;
}

// Counts renders of the component that calls it (dev-only diagnostic).
function useRenderCount() {
  const count = useRef(0);
  count.current += 1;
  return count.current;
}

// ============================================================
// 5. SECTIONS
// ============================================================

function RoutesSection({
  paramNames,
  paramValue,
  setParam,
  goTo,
  currentPath,
}: {
  paramNames: string[];
  paramValue: (name: string) => string;
  setParam: (name: string, value: string) => void;
  goTo: (path: string) => void;
  currentPath?: string;
}) {
  return (
    <SectionPanel>
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
          const active = currentPath === route.path;
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
    </SectionPanel>
  );
}

function EventsSection({
  events,
  clearEvents,
}: {
  events: WsEvent[];
  clearEvents: () => void;
}) {
  return (
    <SectionPanel>
      <div className="flex items-center gap-2">
        <span className="opacity-60">
          websocket frames (last {MAX_EVENTS})
        </span>
        <button type="button" className="btn btn-xs" onClick={clearEvents}>
          clear
        </button>
      </div>
      {events.length === 0 ? (
        <p className="opacity-60">no frames recorded yet</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto font-mono">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span className="opacity-50">{event.at}</span>
              <span
                className={
                  event.direction === "in" ? "text-success" : "text-info"
                }
              >
                {event.direction === "in" ? "<<" : ">>"}
              </span>
              <span className="truncate">{short(event.payload)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionPanel>
  );
}

function FriendsSection() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<Response>) {
    setMessage(`${label}…`);
    try {
      const res = await action();
      setMessage(
        res.ok ? `${label}: ok (${res.status})` : `${label}: HTTP ${res.status}`,
      );
    } catch (err) {
      setMessage(`${label}: ${errorMessage(err)}`);
    }
  }

  async function sendRequest() {
    const username = name.trim();
    if (username === "") return;
    await run(`request ${username}`, async () => {
      const lookup = await fetch(
        `/api/user/users/by-username/${encodeURIComponent(username)}`,
        { credentials: "include" },
      );
      if (!lookup.ok) return lookup;
      const target = (await lookup.json()) as { id: string };
      return fetch(`/api/user/friends/request/${target.id}`, {
        method: "POST",
        credentials: "include",
      });
    });
  }

  async function acceptAll() {
    await run("accept all", async () => {
      const res = await fetch("/api/user/friends/requests/received", {
        credentials: "include",
      });
      if (!res.ok) return res;
      const data = (await res.json()) as { receivedRequests: { id: string }[] };
      let last: Response = res;
      for (const request of data.receivedRequests) {
        last = await fetch(`/api/user/friends/accept/${request.id}`, {
          method: "POST",
          credentials: "include",
        });
      }
      return last;
    });
  }

  async function removeAll() {
    await run("remove all", async () => {
      const res = await fetch("/api/user/friends", { credentials: "include" });
      if (!res.ok) return res;
      const data = (await res.json()) as { friends: { id: string }[] };
      let last: Response = res;
      for (const friend of data.friends) {
        last = await fetch(`/api/user/friends/${friend.id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
      return last;
    });
  }

  return (
    <SectionPanel>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input input-xs w-40"
          value={name}
          placeholder="username"
          aria-label="Username for the friend request"
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => void sendRequest()}
        >
          send request
        </button>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => void acceptAll()}
        >
          accept all
        </button>
        <button
          type="button"
          className="btn btn-xs btn-error"
          onClick={() => void removeAll()}
        >
          remove all
        </button>
      </div>
      {message && <p className="opacity-70">{message}</p>}
    </SectionPanel>
  );
}

function ActionsSection({
  socketsRef,
  setParam,
  snapshot,
}: {
  socketsRef: React.RefObject<TrackedSocket[]>;
  setParam: (name: string, value: string) => void;
  snapshot: () => unknown;
}) {
  const [message, setMessage] = useState<string | null>(null);

  // A malformed frame makes the chat server answer with { type: "error" },
  // which exercises the real toast path without touching the providers.
  function simulateWsError() {
    const target = socketsRef.current?.find((entry) =>
      entry.url.includes("/api/chat/ws"),
    );
    if (!target || target.socket.readyState !== WebSocket.OPEN) {
      setMessage("no open chat socket");
      return;
    }
    target.socket.send("not json");
    setMessage("sent malformed frame");
  }

  function reconnectSockets() {
    const sockets = socketsRef.current ?? [];
    for (const entry of sockets) entry.socket.close();
    setMessage(`closed ${sockets.length} socket(s)`);
  }

  async function copyState() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2));
      setMessage("state copied");
    } catch {
      setMessage("clipboard refused");
    }
  }

  async function loadSeedIds() {
    setMessage("resolving seed users…");
    const found: string[] = [];
    for (const name of SEED_USERS) {
      try {
        const res = await fetch(
          `/api/user/users/by-username/${encodeURIComponent(name)}`,
          { credentials: "include" },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { id: string };
        found.push(`${name}=${data.id.slice(0, 8)}`);
        setParam("id", data.id);
      } catch {
        // ignore: the message below reports what was found
      }
    }
    setMessage(found.length > 0 ? found.join(" ") : "no seed users found");
  }

  return (
    <SectionPanel>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-xs"
          onClick={simulateWsError}
        >
          simulate ws error
        </button>
        <button
          type="button"
          className="btn btn-xs"
          onClick={reconnectSockets}
        >
          reconnect sockets
        </button>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => void copyState()}
        >
          copy state
        </button>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => void loadSeedIds()}
        >
          load seed ids
        </button>
      </div>
      {message && <p className="opacity-70">{message}</p>}
    </SectionPanel>
  );
}

function StateSection({
  route,
  viewport,
  renders,
  userId,
  game,
  chat,
  conversationCount,
  messageCount,
  socketCount,
}: {
  route: string;
  viewport: string;
  renders: number;
  userId?: string;
  game: GameContextValue | null;
  chat: ChatContextValue | null;
  conversationCount: number;
  messageCount: number;
  socketCount: number;
}) {
  return (
    <SectionPanel>
      <Field label="route" value={route} />
      <Field label="viewport" value={viewport} />
      <Field label="renders" value={renders} />
      <Field label="user id" value={userId} />
      <Field label="game status" value={game?.status} />
      <Field label="game id" value={game?.gameId} />
      <Field label="room" value={game?.room?.code} />
      <Field label="in queue" value={game?.inQueue} />
      <Field label="chat status" value={chat?.status} />
      <Field label="conversations" value={conversationCount} />
      <Field label="messages" value={messageCount} />
      <Field label="ws sockets" value={socketCount} />
    </SectionPanel>
  );
}

// ============================================================
// 6. SHELL
// ============================================================

export function DebugHeader() {
  const { user, loading, twoFactorPending, logout, refresh } = useAuth();
  const chat = useContext(ChatContext);
  const game = useContext(GameContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  // Each section opens independently: several can be expanded at once.
  const [openSections, setOpenSections] = useState<Record<Section, boolean>>({
    routes: false,
    events: false,
    friends: false,
    actions: false,
    state: false,
  });

  const { events, clearEvents, socketsRef } = useWsEventLog();
  const viewport = useViewport();
  const renders = useRenderCount();

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
  }

  const conversationCount = chat ? Object.keys(chat.conversations).length : 0;
  const messageCount = chat
    ? Object.values(chat.conversations).reduce(
        (total, messages) => total + messages.length,
        0,
      )
    : 0;

  function snapshot() {
    return {
      route: location.pathname,
      user,
      game: game
        ? {
            status: game.status,
            room: game.room,
            gameId: game.gameId,
            inQueue: game.inQueue,
            error: game.error,
          }
        : null,
      chat: chat
        ? {
            status: chat.status,
            conversations: conversationCount,
            messages: messageCount,
            error: chat.error,
          }
        : null,
    };
  }

  async function handleLogout() {
    await logout();
    navigate("/home");
  }

  function toggleSection(section: Section) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  const sectionButton = (section: Section, label: string) => (
    <button
      type="button"
      className={`btn btn-xs ${openSections[section] ? "btn-primary" : ""}`}
      aria-expanded={openSections[section]}
      onClick={() => toggleSection(section)}
    >
      {label} {openSections[section] ? "▴" : "▾"}
    </button>
  );

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

        {sectionButton("routes", "routes")}
        {sectionButton(
          "events",
          events.length > 0 ? `events (${events.length})` : "events",
        )}
        {sectionButton("friends", "friends")}
        {sectionButton("actions", "actions")}
        {sectionButton("state", "state")}

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
        {open && <Field label="viewport" value={viewport} />}
        {open && <Field label="renders" value={renders} />}

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

      {openSections.routes && (
        <RoutesSection
          paramNames={paramNames}
          paramValue={paramValue}
          setParam={setParam}
          goTo={goTo}
          currentPath={currentRoute?.path}
        />
      )}
      {openSections.events && (
        <EventsSection events={events} clearEvents={clearEvents} />
      )}
      {openSections.friends && <FriendsSection />}
      {openSections.actions && (
        <ActionsSection
          socketsRef={socketsRef}
          setParam={setParam}
          snapshot={snapshot}
        />
      )}
      {openSections.state && (
        <StateSection
          route={location.pathname}
          viewport={viewport}
          renders={renders}
          userId={user?.id}
          game={game}
          chat={chat}
          conversationCount={conversationCount}
          messageCount={messageCount}
          socketCount={socketsRef.current?.length ?? 0}
        />
      )}
    </div>
  );
}
