import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { socket, useSocketEvent } from "../socket";
import UnoCard from "../components/UnoCard";
import Modal from "../components/Modal";
import type { Card, GameState, PlayColor, Player, ToastFn, User } from "../types";

interface Props {
  game: GameState | null;
  user: User;
  onExit: () => void;
  toast: ToastFn;
}

interface ChatLine {
  id: string;
  userId: string;
  username: string;
  content: string;
}

const COLORS: PlayColor[] = ["red", "yellow", "green", "blue"];
const COLOR_HEX: Record<string, string> = {
  red: "#e53935",
  yellow: "#fbc02d",
  green: "#43a047",
  blue: "#1e88e5",
  wild: "#222",
};
const TURN_SECONDS = 20;
const BLUFF_SECONDS = 5;

function isPlayable(card: Card, g: GameState, myTurn: boolean): boolean {
  if (!myTurn) {
    return (
      g.settings.jumpIn &&
      g.pendingDrawCount === 0 &&
      card.color !== "wild" &&
      card.color === g.topCard.color &&
      card.value === g.topCard.value
    );
  }
  if (g.pendingDrawCount > 0) {
    if (g.settings.stacking === "none") return false;
    if (g.settings.stacking === "same") return card.value === g.topCard.value;
    return card.value === "draw2" || card.value === "wild_draw4";
  }
  if (card.color === "wild") return true;
  return card.color === g.currentColor || card.value === g.topCard.value;
}

function seatPositions(n: number): string[] {
  if (n === 1) return ["top"];
  if (n === 2) return ["left", "right"];
  return ["left", "top", "right"];
}

function tilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 36) - 18;
}

export default function GamePage({ game, user, onExit, toast }: Props) {
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [wildCard, setWildCard] = useState<Card | null>(null);
  const [sevenCard, setSevenCard] = useState<Card | null>(null);
  const [wiggle, setWiggle] = useState<string | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [unoCalled, setUnoCalled] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [bluffFor, setBluffFor] = useState<string | null>(null);
  const prevTop = useRef<string | null>(null);
  const gameRef = useRef<GameState | null>(game);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const nameOf = (id: string) =>
    id === user.id ? "You" : (gameRef.current?.players.find((p) => p.userId === id)?.username ?? "Someone");

  useSocketEvent((msg) => {
    switch (msg.type) {
      case "chat_message":
        setChat((c) => [
          ...c.slice(-99),
          { id: `${Date.now()}-${Math.random()}`, userId: msg.userId, username: msg.username, content: msg.content },
        ]);
        break;
      case "uno_caught":
        toast(`${nameOf(msg.catcherUserId)} caught ${nameOf(msg.targetUserId)}! +2 cards`, "warn");
        setShaking(msg.targetUserId);
        window.setTimeout(() => setShaking(null), 900);
        break;
      case "bluff_result":
        toast(
          msg.wasBluff
            ? `Bluff exposed! ${nameOf(msg.targetUserId)} draws ${msg.penaltyCount}`
            : `Legit +4 — ${nameOf(msg.challengerUserId)} draws ${msg.penaltyCount}`,
          msg.wasBluff ? "success" : "warn",
        );
        setBluffFor(null);
        break;
      case "game_ended":
        setWinnerId(msg.winnerId);
        break;
      case "player_left":
        if (msg.userId !== user.id) toast(`${nameOf(msg.userId)} left the table`);
        break;
    }
  });

  // Detect a fresh +4 played on me (bluff window)
  useEffect(() => {
    if (!game || game.topCard.id === prevTop.current) return;
    prevTop.current = game.topCard.id;
    const current = game.players.find((p) => p.isCurrentTurn);
    setBluffFor(
      game.settings.bluffChallenge && game.topCard.value === "wild_draw4" && current?.userId === user.id
        ? game.topCard.id
        : null,
    );
  }, [game, user.id]);

  const myHandSize = game?.players.find((p) => p.userId === user.id)?.hand.length ?? 0;
  useEffect(() => {
    if (myHandSize !== 1) setUnoCalled(false);
  }, [myHandSize]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const opponents = useMemo<Player[]>(() => {
    if (!game) return [];
    const idx = game.players.findIndex((p) => p.userId === user.id);
    return [...game.players.slice(idx + 1), ...game.players.slice(0, Math.max(idx, 0))];
  }, [game, user.id]);

  if (!game) {
    return (
      <div className="game-loading">
        <div className="shuffle">
          <UnoCard faceDown size="lg" />
          <UnoCard faceDown size="lg" />
          <UnoCard faceDown size="lg" />
        </div>
        <p>Shuffling the deck…</p>
      </div>
    );
  }

  const g: GameState = game;
  const me = g.players.find((p) => p.userId === user.id);
  const hand = me?.hand ?? [];
  const myTurn = !!me?.isCurrentTurn;
  const current = g.players.find((p) => p.isCurrentTurn);
  const finalWinner = winnerId ?? g.winnerId ?? null;
  const finished = g.status === "finished" || finalWinner !== null;
  const bluffActive = !finished && myTurn && bluffFor === g.topCard.id;
  const locked = finished || bluffActive;
  const turnKey = `${current?.userId}-${g.topCard.id}-${g.drawPileCount}`;
  const positions = seatPositions(opponents.length);

  function play(card: Card, chosenColor?: PlayColor, targetUserId?: string) {
    socket.send({
      type: "play_card",
      gameId: g.id,
      cardId: card.id,
      ...(chosenColor ? { chosenColor } : {}),
      ...(targetUserId ? { targetUserId } : {}),
    });
  }

  function onCardClick(card: Card) {
    if (locked) return;
    if (!isPlayable(card, g, myTurn)) {
      setWiggle(card.id);
      window.setTimeout(() => setWiggle((w) => (w === card.id ? null : w)), 450);
      return;
    }
    if (card.color === "wild") return setWildCard(card);
    if (g.settings.sevenZeroRule && card.value === "7") return setSevenCard(card);
    play(card);
  }

  function draw() {
    if (!myTurn || locked) return;
    socket.send({ type: "draw_card", gameId: g.id });
  }

  function sendChat(e: FormEvent) {
    e.preventDefault();
    const content = chatInput.trim();
    if (!content) return;
    socket.send({ type: "chat_message", gameId: g.id, content });
    setChatInput("");
  }

  const n = hand.length;
  const spread = Math.min(6, 60 / Math.max(n, 1));
  const overlap = n > 14 ? -62 : n > 9 ? -52 : -38;
  const under = g.discardPile.filter((c) => c.id !== g.topCard.id).slice(-3);

  let status: string;
  if (finished) status = "Game over";
  else if (bluffActive) status = "A +4 on you… bluff?";
  else if (myTurn && g.pendingDrawCount > 0) status = `Stack it or draw ${g.pendingDrawCount}!`;
  else if (myTurn) status = "Your turn!";
  else status = `${current?.username ?? "…"} is thinking`;

  return (
    <div className={`game-layout ${chatOpen ? "" : "chat-closed"}`}>
      <div className="table" style={{ "--current": COLOR_HEX[g.currentColor] } as CSSProperties}>
        <div className="table-glow" />

        {opponents.map((p, i) => {
          const rank = g.ranking.indexOf(p.userId);
          return (
            <div
              key={p.userId}
              className={`seat seat-${positions[i]} ${p.isCurrentTurn ? "active" : ""} ${
                p.disconnected ? "gone" : ""
              } ${shaking === p.userId ? "shake" : ""}`}
            >
              <div className="seat-cards">
                {Array.from({ length: Math.min(p.hand.length, 9) }).map((_, idx, arr) => (
                  <UnoCard
                    key={idx}
                    faceDown
                    size="sm"
                    className="deal-in"
                    style={{
                      marginLeft: idx === 0 ? 0 : -26,
                      transform: `rotate(${(idx - (arr.length - 1) / 2) * 6}deg)`,
                    }}
                  />
                ))}
                {p.hand.length > 9 && <span className="more">+{p.hand.length - 9}</span>}
              </div>
              <div className="seat-info">
                <div className="avatar">{p.username[0]?.toUpperCase()}</div>
                <div>
                  <div className="seat-name">{p.username}</div>
                  <div className="seat-count muted">
                    {p.disconnected
                      ? "disconnected"
                      : rank >= 0
                        ? `finished #${rank + 1}`
                        : `${p.hand.length} card${p.hand.length > 1 ? "s" : ""}`}
                  </div>
                </div>
                {p.hand.length === 1 && <span className="uno-badge">UNO</span>}
              </div>
              {g.settings.unoCallout && p.hand.length === 1 && !finished && (
                <button
                  className="btn danger small catch"
                  onClick={() => socket.send({ type: "catch_uno", gameId: g.id, targetUserId: p.userId })}
                >
                  Catch!
                </button>
              )}
              {p.isCurrentTurn && !finished && (
                <div className="turn-bar" key={turnKey}>
                  <div style={{ animationDuration: `${TURN_SECONDS}s` }} />
                </div>
              )}
            </div>
          );
        })}

        <div className="center-area">
          <div className={`direction ${g.direction === 1 ? "cw" : "ccw"}`}>{g.direction === 1 ? "↻" : "↺"}</div>

          <div
            className={`draw-pile ${myTurn && !locked ? "can-draw" : ""}`}
            onClick={draw}
            title={myTurn ? "Draw" : ""}
          >
            <UnoCard faceDown size="lg" className="stack s3" />
            <UnoCard faceDown size="lg" className="stack s2" />
            <UnoCard faceDown size="lg" className="stack s1" />
            <span className="pile-count">{g.drawPileCount}</span>
            {myTurn && !locked && <span className="pile-hint">DRAW{g.pendingDrawCount > 0 ? ` ${g.pendingDrawCount}` : ""}</span>}
          </div>

          <div className="discard">
            <div className="color-ring" />
            {under.map((c) => (
              <UnoCard key={c.id} card={c} size="lg" className="under" style={{ transform: `rotate(${tilt(c.id)}deg)` }} />
            ))}
            <UnoCard key={g.topCard.id} card={g.topCard} size="lg" className="top-card" />
            {g.pendingDrawCount > 0 && <span className="pending" key={g.pendingDrawCount}>+{g.pendingDrawCount}</span>}
          </div>
        </div>

        <div className={`status-banner ${myTurn && !finished ? "mine" : ""}`} key={status}>
          {status}
        </div>

        <div className={`my-zone ${myTurn ? "active" : ""} ${shaking === user.id ? "shake" : ""}`}>
          {myTurn && !finished && (
            <div className="turn-bar mine" key={turnKey}>
              <div style={{ animationDuration: `${TURN_SECONDS}s` }} />
            </div>
          )}
          <div className="hand">
            {hand.map((card, i) => {
              const offset = i - (n - 1) / 2;
              const playable = !locked && isPlayable(card, g, myTurn);
              return (
                <div
                  key={card.id}
                  className="hand-slot"
                  style={
                    {
                      "--rot": `${offset * spread}deg`,
                      "--drop": `${offset * offset * 0.8}px`,
                      marginLeft: i === 0 ? 0 : overlap,
                      zIndex: i,
                    } as CSSProperties
                  }
                >
                  <UnoCard
                    card={card}
                    size="lg"
                    playable={playable}
                    dimmed={myTurn && !playable && !locked}
                    className={`deal-in ${wiggle === card.id ? "wiggle" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    onClick={() => onCardClick(card)}
                  />
                </div>
              );
            })}
          </div>
          <div className="my-actions">
            <div className="me-tag">
              <div className="avatar">{user.username[0]?.toUpperCase()}</div>
              <span>{user.username}</span>
              <span className="muted">· {hand.length} cards</span>
            </div>
            {g.settings.unoCallout && hand.length === 1 && !unoCalled && !finished && (
              <button
                className="btn uno-btn"
                onClick={() => {
                  socket.send({ type: "call_uno", gameId: g.id });
                  setUnoCalled(true);
                  toast("UNO!", "success");
                }}
              >
                UNO!
              </button>
            )}
            <button className="btn ghost small" onClick={() => setChatOpen((o) => !o)}>
              💬
            </button>
          </div>
        </div>

        {bluffActive && (
          <div className="bluff-panel pop-in">
            <h3>Wild +4 on you!</h3>
            <p className="muted">Think they had a matching color? Wrong guess = +6.</p>
            <div className="bluff-actions">
              <button
                className="btn danger"
                onClick={() => {
                  socket.send({ type: "challenge_bluff", gameId: g.id });
                  setBluffFor(null);
                }}
              >
                Challenge
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  socket.send({ type: "accept_wild_draw4", gameId: g.id });
                  setBluffFor(null);
                }}
              >
                Accept +4
              </button>
            </div>
            <div className="turn-bar mine">
              <div style={{ animationDuration: `${BLUFF_SECONDS}s` }} />
            </div>
          </div>
        )}
      </div>

      <aside className="chat panel">
        <h3>Table chat</h3>
        <div className="chat-lines">
          {chat.length === 0 && <p className="muted small">Say something mean.</p>}
          {chat.map((l) => (
            <div key={l.id} className={`chat-line ${l.userId === user.id ? "mine" : ""}`}>
              <b>{l.userId === user.id ? "You" : l.username}</b>
              <span>{l.content}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendChat} className="chat-form">
          <input value={chatInput} maxLength={200} placeholder="Message…" onChange={(e) => setChatInput(e.target.value)} />
          <button className="btn primary small">Send</button>
        </form>
      </aside>

      {wildCard && (
        <Modal title="Pick a color" onClose={() => setWildCard(null)}>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-choice ${c}`}
                onClick={() => {
                  play(wildCard, c);
                  setWildCard(null);
                }}
                aria-label={c}
              />
            ))}
          </div>
        </Modal>
      )}

      {sevenCard && (
        <Modal title="Swap hands with…" onClose={() => setSevenCard(null)}>
          <div className="target-list">
            {opponents
              .filter((p) => !p.disconnected && !g.ranking.includes(p.userId))
              .map((p) => (
                <button
                  key={p.userId}
                  className="target"
                  onClick={() => {
                    play(sevenCard, undefined, p.userId);
                    setSevenCard(null);
                  }}
                >
                  <div className="avatar">{p.username[0]?.toUpperCase()}</div>
                  <span>{p.username}</span>
                  <span className="muted">{p.hand.length} cards</span>
                </button>
              ))}
          </div>
        </Modal>
      )}

      {finished && (
        <div className="end-overlay">
          <div className="confetti" aria-hidden>
            {Array.from({ length: 60 }).map((_, i) => (
              <i
                key={i}
                style={{
                  left: `${(i * 37) % 100}%`,
                  background: COLOR_HEX[COLORS[i % 4]],
                  animationDelay: `${(i % 12) * 0.15}s`,
                  animationDuration: `${2.5 + (i % 5) * 0.4}s`,
                }}
              />
            ))}
          </div>
          <div className="end-card panel pop-in">
            <div className="logo big">UNO</div>
            <h2>{finalWinner === user.id ? "You win! 🏆" : `${nameOf(finalWinner ?? "")} wins!`}</h2>
            {g.ranking.length > 1 && (
              <ol className="ranking">
                {g.ranking.map((id, i) => (
                  <li key={id} className={id === user.id ? "me" : ""}>
                    <span className="medal">{["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`}</span>
                    {id === user.id ? "You" : nameOf(id)}
                  </li>
                ))}
              </ol>
            )}
            <button className="btn primary big" onClick={onExit}>
              Back to lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
