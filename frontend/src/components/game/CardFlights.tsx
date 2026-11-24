import { useEffect, useRef, useState } from "react";
import type { Card as GameCard, GameState } from "shared";
import { Card } from "../cards/Card";
import { CardBack, CardFace } from "./CardFace";
import { themeColor } from "./cards";

const FLIGHT_MS = 550;
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
    const animation = ref.current?.animate(
      [
        {
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
        },
        {
          transform: `translate(${flight.to.x - flight.from.x}px, ${flight.to.y - flight.from.y}px) scale(0.85)`,
          opacity: 0.9,
        },
      ],
      {
        duration: FLIGHT_MS,
        delay: flight.delay,
        easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
        fill: "both",
      },
    );
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

  return (
    <>
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} onDone={remove} />
      ))}
    </>
  );
}
