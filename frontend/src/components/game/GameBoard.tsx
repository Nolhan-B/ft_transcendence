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
import { UserAvatar } from "../user/UserAvatar";
import { OpponentSeat } from "./OpponentSeat";
import type { Seat } from "./OpponentSeat";

// Length of a turn on the server (TURN_TIMEOUT_MS, 20 s by default). It does
// not send the remaining time: the countdown restarts with each new state.
const TURN_SECONDS = 20;

const COLOR_CHOICES: { color: CardColor; label: string; button: string }[] = [
  { color: "red", label: "Red", button: "bg-primary" },
  { color: "yellow", label: "Yellow", button: "bg-accent" },
  { color: "green", label: "Green", button: "bg-success" },
  { color: "blue", label: "Blue", button: "bg-secondary" },
];

// Halo of the color to play, in the middle of the table
const GLOW: Record<CardColor | "wild", string> = {
  red: "bg-primary",
  yellow: "bg-accent",
  green: "bg-success",
  blue: "bg-secondary",
  wild: "bg-white/50",
};

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
    // The table: green cloth with a dark wooden edge
    <div className="relative isolate flex flex-1 flex-col justify-around gap-6 overflow-hidden rounded-[2rem] border-[6px] border-[#3a1d0e] bg-[radial-gradient(ellipse_at_50%_45%,var(--color-felt)_0%,#125a2c_45%,var(--color-felt-dark)_100%)] p-4 shadow-[inset_0_0_120px_rgb(0_0_0/0.6),0_0_0_3px_rgb(255_255_255/0.08),0_25px_60px_rgb(0_0_0/0.5)] compact:gap-3 compact:rounded-3xl compact:p-2 snug:gap-2 snug:p-1 short:gap-2 tiny:gap-1 tiny:rounded-2xl tiny:border-[3px] tiny:p-1">
      {/* Felt grain, and the halo of the color to play */}
      <div
        aria-hidden="true"
        className="bg-felt pointer-events-none absolute inset-0 -z-10 opacity-50 mix-blend-overlay"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-[45%] left-1/2 -z-10 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-500 compact:size-80 ${GLOW[state.currentColor]}`}
      />
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
        {/* Me: avatar and name, glowing on my turn */}
        {me && (
          <div
            className={`mb-6 flex shrink-0 items-center gap-2 rounded-full bg-black/40 py-1 pr-4 pl-1 font-semibold compact:mb-2 snug:hidden ${
              myTurn ? "animate-turn" : ""
            }`}
          >
            <UserAvatar username={me.username} size="sm" />
            You
          </div>
        )}

        {mustCallUno && (
          <button
            type="button"
            className="text-display animate-wobble mb-8 shrink-0 cursor-pointer rounded-full border-4 border-white bg-primary px-7 py-3 text-4xl text-white shadow-[0_0_30px_var(--color-primary)] compact:mb-2 compact:px-5 compact:py-2 compact:text-2xl tiny:border-2 tiny:px-3 tiny:py-1 tiny:text-lg"
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
            arc
            variant="game"
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
        <div className="grid grid-cols-2 gap-4">
          {COLOR_CHOICES.map(({ color, label, button }) => (
            <button
              key={color}
              type="button"
              aria-label={label}
              title={label}
              className={`size-28 cursor-pointer rounded-3xl border-4 border-white shadow-[0_6px_0_rgb(0_0_0/0.3)] transition-transform hover:scale-105 hover:-rotate-3 active:scale-95 compact:size-20 ${button}`}
              onClick={() => choose({ chosenColor: color })}
            />
          ))}
        </div>
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
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-black/30 p-3 text-left font-semibold transition-colors hover:bg-black/50"
              onClick={() => choose({ targetUserId: player.userId })}
            >
              <UserAvatar username={player.username} size="sm" />
              <span className="flex-1 truncate">{player.username}</span>
              <span className="text-sm text-white/65">
                {player.hand.length} cards
              </span>
            </button>
          ))}
      </ChoiceDialog>
    </div>
  );
}
