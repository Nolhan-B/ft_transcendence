import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Card as GameCard, GameState } from "shared";
import { Card } from "../cards/Card";
import { CardBack, CardFace } from "./CardFace";
import { themeColor } from "./cards";

const FLIGHT_MS = 550;
// A played card flies a little longer: it must be seen (the shock wave on
// the discard pile, animate-impact, starts when it lands)
const PLAY_MS = 520;
const STAGGER_MS = 140;
const MAX_FLIGHTS = 4;

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  from: Point;
  to: Point;
  delay: number;
  // The card shown while flying: its back (draw) or its face (played)
  card: GameCard | null;
}

// Center of an element marked with data-anchor="..." (null if not on screen)
function anchor(name: string): Point | null {
  const element = document.querySelector(`[data-anchor="${name}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Where a player's cards are: my hand, or the seat of an opponent
const seat = (userId: string) => anchor(`seat-${userId}`);

function FlyingCard({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dx = flight.to.x - flight.from.x;
    const dy = flight.to.y - flight.from.y;
    // A played card is shown off: it rises in an arc, grows, spins a little
    // and slams on the discard pile. A drawn card simply slides.
    const keyframes: Keyframe[] = flight.card
      ? [
          { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(1.4) rotate(-14deg)`,
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(1.05) rotate(3deg)`,
            opacity: 1,
          },
        ]
      : [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.85)`,
            opacity: 0.9,
          },
        ];
    const animation = ref.current?.animate(keyframes, {
      duration: flight.card ? PLAY_MS : FLIGHT_MS,
      delay: flight.delay,
      easing: flight.card
        ? "cubic-bezier(0.3, 0.7, 0.4, 1)"
        : "cubic-bezier(0.2, 0.8, 0.3, 1)",
      fill: "both",
    });
    if (!animation) return;
    animation.onfinish = () => onDone(flight.id);
    return () => animation.cancel();
  }, [flight, onDone]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed z-40 w-24 opacity-0"
      style={{
        // Centered on the starting point
        left: flight.from.x,
        top: flight.from.y,
        marginLeft: "-3rem",
        marginTop: "-4.65rem",
      }}
    >
      {flight.card ? (
        <Card
          color={themeColor(flight.card.color)}
          variant="game"
          className="w-full"
        >
          <CardFace color={flight.card.color} value={flight.card.value} />
        </Card>
      ) : (
        <Card color="neutral" variant="game" className="w-full">
          <CardBack />
        </Card>
      )}
    </div>
  );
}

interface Props {
  state: GameState;
}

// Animates the cards between the draw pile, the hands and the discard pile
// by comparing each new state with the previous one
export function CardFlights({ state }: Props) {
  const previous = useRef<GameState | null>(null);
  const counter = useRef(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!before) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const draw = anchor("draw");
    const discard = anchor("discard");
    if (!draw || !discard) return;

    const added: Omit<Flight, "id">[] = [];

    // Cards played: the top of the discard pile changed
    if (state.topCard.id !== before.topCard.id) {
      let source: Point | null = draw;
      let biggestDrop = 0;
      for (const player of state.players) {
        const old = before.players.find((p) => p.userId === player.userId);
        const drop = old ? old.hand.length - player.hand.length : 0;
        if (drop > biggestDrop) {
          biggestDrop = drop;
          source = seat(player.userId) ?? draw;
        }
      }
      added.push({ from: source, to: discard, delay: 0, card: state.topCard });
    }

    // Cards drawn: a hand got bigger while the draw pile changed
    if (state.drawPileCount !== before.drawPileCount) {
      for (const player of state.players) {
        const old = before.players.find((p) => p.userId === player.userId);
        const gained = old ? player.hand.length - old.hand.length : 0;
        const target = seat(player.userId);
        if (gained <= 0 || !target) continue;
        for (let i = 0; i < Math.min(gained, MAX_FLIGHTS); i++) {
          added.push({
            from: draw,
            to: target,
            delay: i * STAGGER_MS,
            card: null,
          });
        }
      }
    }

    if (added.length > 0) {
      setFlights((current) => [
        ...current,
        ...added.map((flight) => ({ ...flight, id: counter.current++ })),
      ]);
    }
  }, [state]);

  const remove = useRef((id: number) =>
    setFlights((current) => current.filter((flight) => flight.id !== id)),
  ).current;

  // In <body>: the board may shake (ActionBursts) while the cards fly, and a
  // moving parent would carry these fixed cards along
  return createPortal(
    <>
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} onDone={remove} />
      ))}
    </>,
    document.body,
  );
}
