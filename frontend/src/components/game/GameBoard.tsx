import { useState } from "react";
import type { Card, CardColor, GameState, Player } from "shared";
import { useCountdown } from "../../hooks/game/useCountdown";
import { useUnoWindows } from "../../hooks/game/useUnoWindows";
import { useGame } from "../../hooks/ws/useGame";
import { ChoiceDialog } from "./ChoiceDialog";
import { Hand } from "../cards/Hand";
import { toHandCard } from "./handCards";
import { sortHand } from "./cards";
import { GameTable } from "./GameTable";
import { CardFlights } from "./CardFlights";
import { TurnAnnouncement } from "./TurnAnnouncement";
import { UnoAnnouncement } from "./UnoAnnouncement";
import { OpponentSeat } from "./OpponentSeat";
import type { Seat } from "./OpponentSeat";

// Length of a turn on the server (TURN_TIMEOUT_MS, 20 s by default). It does
// not send the remaining time: the countdown restarts with each new state.
const TURN_SECONDS = 20;

const COLOR_CHOICES: { color: CardColor; label: string; button: string }[] = [
  { color: "red", label: "Red", button: "btn-primary" },
  { color: "yellow", label: "Yellow", button: "btn-accent" },
  { color: "green", label: "Green", button: "btn-success" },
  { color: "blue", label: "Blue", button: "btn-secondary" },
];

// Where the opponents sit, by number of opponents. They are placed in turn
// order starting after me: the next player is on my left.
const SEATS: Record<number, Seat[]> = {
  1: ["top"],
  2: ["left", "right"],
  3: ["left", "top", "right"],
};

// Grid cell of each seat around the central board
const SEAT_CELL: Record<Seat, string> = {
  top: "col-start-2 row-start-1 justify-self-center",
  left: "col-start-1 row-start-2 self-center",
  right: "col-start-3 row-start-2 self-center",
};

function seatOpponents(players: Player[], myId: string) {
  const mine = Math.max(
    0,
    players.findIndex((player) => player.userId === myId),
  );
  const others = players
    .map((player, index) => ({
      player,
      order: (index - mine + players.length) % players.length,
    }))
    .filter(({ player }) => player.userId !== myId)
    .sort((a, b) => a.order - b.order)
    .map(({ player }) => player);
  const seats = SEATS[others.length] ?? [];
  return others.map((player, index) => ({
    player,
    seat: seats[index] ?? "top",
  }));
}

interface Props {
  state: GameState;
  myId: string;
}

// Basic board: opponents on top, the table (draw pile and top card) in the
// middle, my hand at the bottom
export function GameBoard({ state, myId }: Props) {
  const {
    playCard,
    drawCard,
    callUno,
    catchUno,
    turnStartedAt,
    unoCalls,
    unoEvent,
  } = useGame();
  const turnLeft = useCountdown(turnStartedAt, TURN_SECONDS);
  // A card waiting for a choice: its color (wild) or the player to swap with (7)
  const [asking, setAsking] = useState<{
    card: Card;
    kind: "color" | "target";
  } | null>(null);

  const me = state.players.find((player) => player.userId === myId);
  const turnPlayer = state.players.find((player) => player.isCurrentTurn);
  const seated = seatOpponents(state.players, myId);
  const myTurn = me?.isCurrentTurn ?? false;
  // Cards stay visible when it is not your turn (except with jump-in)
  const canPlayNow = myTurn || state.settings.jumpIn;
  const handCards = sortHand(me?.hand ?? []).map((card) =>
    toHandCard(card, !canPlayNow),
  );
  // Visible part of each card: 70% of it, less when the hand is large
  const overlap = `calc(var(--card-w) * -1 + min(var(--card-w) * 0.7, ${60 / Math.max(handCards.length - 1, 1)}rem, ${85 / Math.max(handCards.length - 1, 1)}vw))`;
  const opponents = seated.map(({ player }) => player);
  // Players down to one card who have not said UNO yet (5 s window)
  const unoAtRisk = useUnoWindows(state, turnStartedAt, unoCalls);
  const mustCallUno = unoAtRisk.includes(myId);
  // Bots play after a short delay, without a timer
  const timerFor = (player: Player) =>
    player.isCurrentTurn &&
    !player.disconnected &&
    !player.userId.startsWith("bot_")
      ? turnLeft
      : null;

  function play(card: Card) {
    if (card.color === "wild") setAsking({ card, kind: "color" });
    else if (state.settings.sevenZeroRule && card.value === "7")
      setAsking({ card, kind: "target" });
    else playCard(card.id);
  }

  function choose(options: { chosenColor?: CardColor; targetUserId?: string }) {
    if (asking) playCard(asking.card.id, options);
    setAsking(null);
  }

  return (
    // Frame of the game: 80% opaque, the neon city shows a little through it
    <div className="relative flex flex-1 flex-col justify-around gap-6 rounded-box border-4 border-base-content/20 bg-base-200/80 p-4 shadow-[inset_0_0_120px_var(--color-base-300)] compact:gap-3 compact:p-2 snug:gap-2 snug:p-1 short:gap-2 tiny:gap-1 tiny:border-2 tiny:p-1">
      {/* Opponents around the board: left, top and right */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-4 compact:gap-2 snug:gap-1 tiny:gap-1">
        <>
          {seated.map(({ player, seat }) => (
            <div key={player.userId} className={SEAT_CELL[seat]}>
              <OpponentSeat
                player={player}
                canCatchUno={unoAtRisk.includes(player.userId)}
                onCatchUno={() => catchUno(player.userId)}
              />
            </div>
          ))}
        </>

        {/* Central board */}
        <div className="col-start-2 row-start-2">
          <GameTable
            state={state}
            myTurn={myTurn}
            onDraw={drawCard}
            turnName={turnPlayer?.username ?? ""}
            secondsLeft={turnPlayer ? timerFor(turnPlayer) : null}
            turnSeconds={TURN_SECONDS}
            botTurn={turnPlayer?.userId.startsWith("bot_") ?? false}
          />
        </div>
      </div>

      {/* Me: my hand, and the UNO button beside it while I can say it (I
          have only one card left then, so there is room for it) */}
      <div className="flex items-end justify-center gap-6 compact:gap-3">
        {mustCallUno && (
          <button
            type="button"
            className="btn btn-warning btn-xl mb-8 animate-pulse text-3xl font-black shadow-[0_0_30px_var(--color-warning)] compact:btn-lg compact:mb-2 compact:text-2xl tiny:btn-md tiny:text-lg"
            onClick={callUno}
          >
            UNO!
          </button>
        )}

        <div
          className="pt-8 pb-2 compact:pt-3 compact:pb-0 snug:pt-1 tiny:pt-1"
          data-anchor={`seat-${myId}`}
        >
          <Hand
            cards={handCards}
            fan="row"
            variant="neon"
            className="max-w-full"
            overlap={overlap}
            cardClassName="[--card-w:min(9.75rem,16vw)] w-(--card-w) compact:[--card-w:min(5.5rem,16vw)] snug:[--card-w:min(4.5rem,16vw)] short:[--card-w:min(4.75rem,16vw)] tiny:[--card-w:min(3.5rem,16vw)]"
            onSelect={(id) => {
              const card = me?.hand.find((c) => c.id === id);
              if (card) play(card);
            }}
          />
        </div>
      </div>

      <CardFlights state={state} />

      <TurnAnnouncement
        playerId={turnPlayer?.userId}
        name={turnPlayer?.username ?? ""}
        mine={myTurn}
      />

      <UnoAnnouncement event={unoEvent} players={state.players} myId={myId} />

      <ChoiceDialog
        open={asking?.kind === "color"}
        title="Choose a color"
        onClose={() => setAsking(null)}
      >
        {COLOR_CHOICES.map(({ color, label, button }) => (
          <button
            key={color}
            type="button"
            className={`btn ${button}`}
            onClick={() => choose({ chosenColor: color })}
          >
            {label}
          </button>
        ))}
      </ChoiceDialog>

      <ChoiceDialog
        open={asking?.kind === "target"}
        title="Swap your hand with..."
        onClose={() => setAsking(null)}
      >
        {opponents
          .filter((player) => !player.disconnected)
          .map((player) => (
            <button
              key={player.userId}
              type="button"
              className="btn btn-neutral"
              onClick={() => choose({ targetUserId: player.userId })}
            >
              {player.username} ({player.hand.length})
            </button>
          ))}
      </ChoiceDialog>
    </div>
  );
}
