import { useCallback, useEffect, useState } from "react";
import { socket, useSocketEvent } from "./socket";
import AuthPage from "./pages/AuthPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";
import GamePage from "./pages/GamePage";
import type { GameState, RoomInfo, ToastKind, User } from "./types";

type View = "lobby" | "room" | "game";

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(loadUser);
  const [view, setView] = useState<View>("lobby");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!token) return;
    socket.connect(token);
    return () => socket.close();
  }, [token]);

  useSocketEvent((msg) => {
    switch (msg.type) {
      case "room_updated":
        setRoom(msg.room);
        setView((v) => (v === "game" ? v : "room"));
        break;
      case "game_started":
        setRoom(null);
        setGame(null);
        socket.send({ type: "join_game", gameId: msg.gameId });
        setView("game");
        break;
      case "game_updated":
        setGame(msg.state);
        break;
      case "error":
        toast(msg.message, "error");
        break;
    }
  });

  function onAuth(t: string, u: User) {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
    setToken(t);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    socket.close();
    setToken(null);
    setUser(null);
    setView("lobby");
    setRoom(null);
    setGame(null);
  }

  function backToLobby() {
    setGame(null);
    setRoom(null);
    setView("lobby");
  }

  if (!token || !user) {
    return (
      <>
        <AuthPage onAuth={onAuth} />
        <Toasts toasts={toasts} />
      </>
    );
  }

  return (
    <div className={`app view-${view}`}>
      <header className="topbar">
        <div className="logo" onClick={() => view !== "game" && backToLobby()}>
          UNO
        </div>
        <div className="topbar-right">
          {view === "game" && (
            <button
              className="btn ghost small"
              onClick={() => {
                if (window.confirm("Leave the table? You'll be marked AFK.")) backToLobby();
              }}
            >
              Quit table
            </button>
          )}
          <div className="me-chip">
            <div className="avatar">{user.username[0]?.toUpperCase()}</div>
            {user.username}
          </div>
          <button className="btn ghost small" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main>
        {view === "lobby" && <LobbyPage token={token} toast={toast} />}
        {view === "room" && room && <RoomPage room={room} user={user} toast={toast} onLeave={backToLobby} />}
        {view === "game" && <GamePage game={game} user={user} toast={toast} onExit={backToLobby} />}
      </main>

      <Toasts toasts={toasts} />
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
