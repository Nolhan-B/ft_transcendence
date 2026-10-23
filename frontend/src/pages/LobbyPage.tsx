import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { socket } from "../socket";
import Modal from "../components/Modal";
import { activeRules } from "../components/rules";
import type { GameMode, RoomInfo, ToastFn } from "../types";

interface Props {
  token: string;
  toast: ToastFn;
}

export default function LobbyPage({ token, toast }: Props) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [passwordFor, setPasswordFor] = useState<RoomInfo | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [code, setCode] = useState("");
  const [codePassword, setCodePassword] = useState("");

  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("classic");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomPassword, setRoomPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRooms(await api.listRooms(token));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load rooms", "error");
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(t);
  }, [refresh]);

  function joinRoom(roomCode: string, password?: string) {
    socket.send({ type: "join_room", roomCode, ...(password ? { password } : {}) });
  }

  function onJoinClick(room: RoomInfo) {
    if (room.hasPassword) {
      setJoinPassword("");
      setPasswordFor(room);
    } else joinRoom(room.code);
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { roomCode } = await api.createRoom(token, {
        name: name.trim() || "UNO party",
        mode,
        maxPlayers,
        ...(roomPassword ? { password: roomPassword } : {}),
      });
      joinRoom(roomCode, roomPassword || undefined);
      setShowCreate(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create room", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="lobby page">
      <div className="lobby-head">
        <div>
          <h1>Game rooms</h1>
          <p className="muted">Pick a table or open your own.</p>
        </div>
        <div className="lobby-actions">
          <form
            className="code-join"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) joinRoom(code.trim().toUpperCase(), codePassword || undefined);
            }}
          >
            <input
              placeholder="ROOM CODE"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <input
              placeholder="password"
              type="password"
              value={codePassword}
              onChange={(e) => setCodePassword(e.target.value)}
            />
            <button className="btn ghost">Join</button>
          </form>
          <button className={`btn ghost ${loading ? "spinning" : ""}`} onClick={() => void refresh()}>
            ⟳
          </button>
          <button className="btn primary" onClick={() => setShowCreate(true)}>
            + New room
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="empty panel">
          <div className="empty-cards">🃏</div>
          <p>No room yet. Be the one who starts the chaos.</p>
          <button className="btn primary" onClick={() => setShowCreate(true)}>
            Create a room
          </button>
        </div>
      ) : (
        <div className="room-grid">
          {rooms.map((r, i) => {
            const full = r.players.length >= r.maxPlayers;
            return (
              <div className="room-card panel pop-in" key={r.code} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="room-card-head">
                  <h3>{r.name}</h3>
                  {r.hasPassword && <span title="Password protected">🔒</span>}
                </div>
                <div className="room-meta">
                  <span className={`badge mode-${r.mode}`}>{r.mode}</span>
                  <span className="room-code">#{r.code}</span>
                </div>
                <div className="seat-dots">
                  {Array.from({ length: r.maxPlayers }).map((_, idx) => (
                    <span key={idx} className={idx < r.players.length ? "filled" : ""} />
                  ))}
                  <span className="muted">
                    {r.players.length}/{r.maxPlayers}
                  </span>
                </div>
                <div className="chips">
                  {activeRules(r.settings).length === 0 ? (
                    <span className="chip muted">Classic rules</span>
                  ) : (
                    activeRules(r.settings).map((rule) => (
                      <span className="chip" key={rule}>
                        {rule}
                      </span>
                    ))
                  )}
                </div>
                <button className="btn primary" disabled={full} onClick={() => onJoinClick(r)}>
                  {full ? "Full" : "Join"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="New room" onClose={() => setShowCreate(false)}>
          <form className="form" onSubmit={createRoom}>
            <label>
              Room name
              <input value={name} maxLength={30} placeholder="UNO party" onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="field">
              <span>Mode</span>
              <div className="segmented">
                {(["classic", "ranked"] as GameMode[]).map((m) => (
                  <button type="button" key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                    {m === "classic" ? "Classic" : "Ranked"}
                  </button>
                ))}
              </div>
              <small className="muted">
                {mode === "classic" ? "First to empty their hand wins." : "Play until the last one — full ranking."}
              </small>
            </div>
            <div className="field">
              <span>Players</span>
              <div className="segmented">
                {[2, 3, 4].map((n) => (
                  <button type="button" key={n} className={maxPlayers === n ? "active" : ""} onClick={() => setMaxPlayers(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Password <small className="muted">(optional)</small>
              <input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} />
            </label>
            <button className="btn primary big" disabled={creating}>
              {creating ? "..." : "Open the table"}
            </button>
          </form>
        </Modal>
      )}

      {passwordFor && (
        <Modal title={`Join "${passwordFor.name}"`} onClose={() => setPasswordFor(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              joinRoom(passwordFor.code, joinPassword);
              setPasswordFor(null);
            }}
          >
            <label>
              Password
              <input type="password" autoFocus value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} />
            </label>
            <button className="btn primary big">Join</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
