import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RefObject } from "react";
import type { CardColor, DrawReason, GameAction, GameState } from "shared";

// How long a burst stays on screen (same as the CSS animations, delay of
// the blast included)
const BLAST_MS = 2250;
const CALLOUT_MS = 1400;

// Why someone takes cards, said in the blast
const DRAW_TITLE: Partial<Record<DrawReason, string>> = {
  draw2: "Draw two!",
  wild_draw4: "Wild +4!",
  stack: "The stack lands!",
  uno_penalty: "Forgot to say UNO!",
};

const COLOR_PILL: Record<CardColor, string> = {
  red: "bg-primary text-primary-content",
  yellow: "bg-accent text-accent-content",
  green: "bg-success text-success-content",
  blue: "bg-secondary text-secondary-content",
  wild: "bg-neutral text-neutral-content",
};

interface Blast {
  id: number;
  // Center of the board on screen, when the blast started
  x: number;
  y: number;
  big: string; // "+4", "BLUFF!"...
  title: string;
  subtitle?: string;
  mine: boolean; // it hits me: bigger, red, the screen shakes
}

interface Callout {
  id: number;
  text: string;
  className: string;
}

interface Props {
  state: GameState;
  myId: string;
  // The board, shaken when I take cards
  board: RefObject<HTMLDivElement | null>;
}

// Makes the actions of the game impossible to miss: a big "+2"/"+4" bursting
// in the middle when someone takes cards (a red flash and a shake when it is
// me), the result of a bluff challenge, and small callouts for skip,
// reverse, the color chosen with a wild... Built from state.lastActions; the
// "seq" number makes sure each action is shown only once (a reconnection
// sends the same actions again).
export function ActionBursts({ state, myId, board }: Props) {
  const lastSeq = useRef<number | null>(null);
  const counter = useRef(0);
  const [blast, setBlast] = useState<Blast | null>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    const actions = state.lastActions ?? [];
    const newest = Math.max(
      lastSeq.current ?? -1,
      ...actions.map((a) => a.seq),
    );
    // First state (joining, reconnection): nothing new to show
    if (lastSeq.current === null) {
      lastSeq.current = newest;
      return;
    }
    const fresh = actions.filter((a) => a.seq > (lastSeq.current ?? -1));
    lastSeq.current = newest;
    if (fresh.length === 0) return;

    // The blast is drawn in <body> (above the flying cards), at the
    // middle of the board
    const boardCenter = () => {
      const rect = board.current?.getBoundingClientRect();
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.42 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    };
    const name = (id: string) =>
      id === myId
        ? "You"
        : (state.players.find((p) => p.userId === id)?.username ?? "?");
    const newCallouts: Callout[] = [];
    let newBlast: Blast | null = null;
    const callout = (text: string, className = "bg-black/70 text-white") =>
      newCallouts.push({ id: counter.current++, text, className });

    for (const action of fresh as GameAction[]) {
      switch (action.type) {
        case "card_played": {
          const { card } = action;
          if (card.value === "skip") {
            // Blocked player: the next one still at the table after the one
            // who played (same walk as advanceToNextPlayer on the server)
            const from = state.players.findIndex(
              (p) => p.userId === action.userId,
            );
            const count = state.players.length;
            let skipped: string | undefined;
            for (let step = 1; from !== -1 && step < count; step++) {
              const p =
                state.players[
                  (from + step * state.direction + count * step) % count
                ];
              if (!p.disconnected) {
                skipped = p.userId;
                break;
              }
            }
            if (skipped) {
              const mine = skipped === myId;
              newBlast = {
                id: counter.current++,
                ...boardCenter(),
                big: "⊘",
                title: "Blocked!",
                subtitle: mine
                  ? "You skip your turn!"
                  : `${name(skipped)} skips a turn`,
                mine,
              };
            } else callout("⊘ Skip!");
          }
          if (card.value === "reverse") {
            // With two players the direction does not change: the one who
            // played goes again (the server does not flip state.direction)
            const duo =
              state.players.filter((p) => !p.disconnected).length === 2;
            const clockwise = state.direction === 1;
            newBlast = {
              id: counter.current++,
              ...boardCenter(),
              big: duo ? "⇄" : clockwise ? "↻" : "↺",
              title: "Reverse!",
              subtitle: duo
                ? action.userId === myId
                  ? "Your turn again!"
                  : `${name(action.userId)} plays again`
                : clockwise
                  ? "Now clockwise"
                  : "Now counter-clockwise",
              mine: false,
            };
          }
          if (action.chosenColor)
            callout(
              `${name(action.userId)} chose ${action.chosenColor}`,
              COLOR_PILL[action.chosenColor],
            );
          if (action.jumpIn) callout(`⚡ Jump-in by ${name(action.userId)}!`);
          // Stacking: the pile grows, it will land on someone later
          if (
            state.pendingDrawCount > 0 &&
            (card.value === "draw2" || card.value === "wild_draw4")
          )
            callout(
              `Stacked! +${state.pendingDrawCount} waiting`,
              "bg-primary text-white",
            );
          break;
        }
        case "cards_drawn": {
          const title = DRAW_TITLE[action.reason];
          if (!title || action.count < 2) break;
          const mine = action.userId === myId;
          newBlast = {
            id: counter.current++,
            ...boardCenter(),
            big: `+${action.count}`,
            title,
            subtitle: mine
              ? "For you!"
              : `${name(action.userId)} draws ${action.count}`,
            mine,
          };
          break;
        }
        case "bluff_challenged": {
          // The penalty that follows is in the same blast
          const loser = action.wasBluff ? action.targetUserId : action.userId;
          newBlast = {
            id: counter.current++,
            ...boardCenter(),
            big: action.wasBluff ? "BLUFF!" : "No bluff!",
            title: action.wasBluff
              ? `${name(action.userId)} caught ${name(action.targetUserId)}`
              : `${name(action.targetUserId)} played fair`,
            subtitle: `${name(loser)} ${loser === myId ? "draw" : "draws"} ${action.wasBluff ? 4 : 6}`,
            mine: loser === myId,
          };
          break;
        }
        case "wild_draw4_accepted":
          callout(`${name(action.userId)} accepted the +4`);
          break;
        case "hands_swapped":
          callout(
            `${name(action.userId)} ⇄ ${name(action.targetUserId)}: hands swapped!`,
            "bg-secondary text-white",
          );
          break;
        case "hands_rotated":
          callout("Every hand moves on!", "bg-secondary text-white");
          break;
        case "player_finished":
          callout(`🏁 ${name(action.userId)} finished #${action.rank}`);
          break;
        case "player_kicked":
          callout(
            `${name(action.userId)} left the table${action.reason === "afk" ? " (AFK)" : ""}`,
          );
          break;
      }
    }

    if (newBlast) {
      const hit = newBlast.mine;
      setBlast(newBlast);
      if (hit) {
        setFlash(newBlast.id);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          board.current?.animate(
            [
              { translate: "0 0" },
              { translate: "-8px 2px" },
              { translate: "8px -2px" },
              { translate: "-6px 1px" },
              { translate: "6px -1px" },
              { translate: "-3px 0" },
              { translate: "0 0" },
            ],
            { duration: 550, delay: 500, easing: "ease-in-out" },
          );
      }
    }
    if (newCallouts.length > 0)
      setCallouts((current) => [...current, ...newCallouts].slice(-3));
  }, [state, myId, board]);

  // Each burst leaves on its own
  useEffect(() => {
    if (!blast) return;
    const timer = setTimeout(() => setBlast(null), BLAST_MS);
    return () => clearTimeout(timer);
  }, [blast]);

  useEffect(() => {
    if (callouts.length === 0) return;
    const timer = setTimeout(() => setCallouts((c) => c.slice(1)), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [callouts]);

  return (
    <>
      {/* Red flash on the edges of the screen. In <body>: the board moves
          while it shakes, the flash must not */}
      {flash !== null &&
        createPortal(
          <div
            key={flash}
            aria-hidden="true"
            className="animate-flash pointer-events-none fixed inset-0 z-40 [animation-delay:0.45s] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(229_57_53/0.55)_100%)]"
            onAnimationEnd={() => setFlash(null)}
          />,
          document.body,
        )}

      {/* In <body>, above the flying cards. Centered by the outer box; the
          inner one is animated (the animation uses "translate", it would
          undo the centering) */}
      {blast &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
            style={{ left: blast.x, top: blast.y }}
          >
            <div
              key={blast.id}
              role="status"
              className="animate-blast flex flex-col items-center text-center"
            >
              <span
                className={`leading-none font-black tracking-tight [-webkit-text-stroke:3px_white] [paint-order:stroke_fill] [text-shadow:0_8px_0_rgb(0_0_0/0.35),0_0_40px_currentColor] ${
                  blast.mine
                    ? "text-[9rem] text-primary compact:text-[6rem] tiny:text-[4rem]"
                    : "text-[6rem] text-accent compact:text-[4rem] tiny:text-[3rem]"
                }`}
              >
                {blast.big}
              </span>
              <span className="mt-2 rounded-full bg-black/80 px-5 py-1.5 text-xl font-bold whitespace-nowrap text-white shadow-xl compact:text-base tiny:text-xs">
                {blast.title}
                {blast.subtitle && (
                  <span
                    className={`ml-2 ${blast.mine ? "text-primary" : "text-accent"}`}
                  >
                    {blast.subtitle}
                  </span>
                )}
              </span>
            </div>
          </div>,
          document.body,
        )}

      {/* Callouts, between the table and my hand */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute top-[60%] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2 compact:top-[56%]"
      >
        {callouts.map((c) => (
          <span
            key={c.id}
            className={`animate-callout rounded-full px-4 py-1.5 text-lg font-bold whitespace-nowrap shadow-xl compact:text-sm ${c.className}`}
          >
            {c.text}
          </span>
        ))}
      </div>
    </>
  );
}
