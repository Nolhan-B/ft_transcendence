import { socket } from "../socket";
import { RULE_INFO } from "../components/rules";
import type { GameSettings, RoomInfo, StackingRule, ToastFn, User } from "../types";

interface Props {
  room: RoomInfo;
  user: User;
  onLeave: () => void;
  toast: ToastFn;
}

export default function RoomPage({ room, user, onLeave, toast }: Props) {
  const isLeader = room.leaderId === user.id;
  const canStart = isLeader && room.players.length >= 2;
  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i]);

  function update(patch: Partial<GameSettings>) {
    if (!isLeader) return;
    socket.send({ type: "update_room", roomCode: room.code, settings: { ...room.settings, ...patch } });
  }

  function leave() {
    socket.send({ type: "leave_room", roomCode: room.code });
    onLeave();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      toast("Room code copied!", "success");
    } catch {
      toast(`Code: ${room.code}`);
    }
  }

  return (
    <div className="room page">
      <div className="room-head">
        <div>
          <h1>{room.name}</h1>
          <div className="room-meta">
            <span className={`badge mode-${room.mode}`}>{room.mode}</span>
            {room.hasPassword && <span className="badge">🔒 private</span>}
          </div>
        </div>
        <button className="room-code-big" onClick={() => void copyCode()} title="Copy code">
          <small>ROOM CODE</small>
          <span>{room.code}</span>
        </button>
      </div>

      <div className="room-body">
        <section className="panel">
          <h2>
            Players <span className="muted">{room.players.length}/{room.maxPlayers}</span>
          </h2>
          <div className="player-slots">
            {slots.map((p, i) =>
              p ? (
                <div className="player-slot filled pop-in" key={p.id}>
                  <div className={`avatar c${i % 4}`}>{p.username[0]?.toUpperCase()}</div>
                  <span className="slot-name">
                    {p.username}
                    {p.id === user.id && <span className="muted"> (you)</span>}
                  </span>
                  {p.id === room.leaderId && <span className="crown" title="Leader">👑</span>}
                </div>
              ) : (
                <div className="player-slot empty" key={`empty-${i}`}>
                  <div className="avatar ghost">?</div>
                  <span className="muted waiting-dots">Waiting for player</span>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="panel">
          <h2>
            House rules {!isLeader && <span className="muted small">(leader decides)</span>}
          </h2>
          <div className="rules">
            {RULE_INFO.map((r) => (
              <div className={`rule ${isLeader ? "" : "readonly"}`} key={r.key}>
                <div>
                  <div className="rule-label">{r.label}</div>
                  <div className="rule-desc muted">{r.desc}</div>
                </div>
                {r.key === "stacking" ? (
                  <div className="segmented small">
                    {(["none", "same", "all"] as StackingRule[]).map((s) => (
                      <button
                        key={s}
                        disabled={!isLeader}
                        className={room.settings.stacking === s ? "active" : ""}
                        onClick={() => update({ stacking: s })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    className={`toggle ${room.settings[r.key] ? "on" : ""}`}
                    disabled={!isLeader}
                    onClick={() => update({ [r.key]: !room.settings[r.key] } as Partial<GameSettings>)}
                    aria-label={r.label}
                  >
                    <span />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="room-footer">
        <button className="btn ghost" onClick={leave}>
          ← Leave
        </button>
        {isLeader ? (
          <button
            className={`btn primary big ${canStart ? "glow" : ""}`}
            disabled={!canStart}
            onClick={() => socket.send({ type: "start_game", roomCode: room.code })}
          >
            {canStart ? "Deal the cards!" : "Need 2 players"}
          </button>
        ) : (
          <div className="muted waiting-dots">Waiting for the leader to start</div>
        )}
      </div>
    </div>
  );
}
