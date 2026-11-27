import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Card, CardColor, GameState, Player } from "shared";
import { useSecondsUntil } from "../../hooks/game/useSecondsUntil";
import { useUnoWindows } from "../../hooks/game/useUnoWindows";
import { useGame } from "../../hooks/ws/useGame";
import { ChoiceDialog } from "./ChoiceDialog";
import { Hand } from "../cards/Hand";
import { toHandCard } from "./handCards";
import { playableCards } from "./playable";
import { ActionBursts } from "./ActionBursts";
import { BluffDialog } from "./BluffDialog";
import { sortHand } from "./cards";
import { GameTable } from "./GameTable";
import { CardFlights } from "./CardFlights";
import { TurnAnnouncement } from "./TurnAnnouncement";
import { UnoAnnouncement } from "./UnoAnnouncement";
import { UserAvatar } from "../user/UserAvatar";
import { OpponentSeat } from "./OpponentSeat";
import { TurnBar } from "./TurnBar";
import {
  handScale,
  rowLift,
  rowOverlap,
  scaled,
  splitIntoRows,
  useHandLayout,
} from "./handRows";
import type { Seat } from "./OpponentSeat";

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
  // Spectator: nobody is "me", the fourth player sits at the bottom
  4: ["left", "top", "right", "bottom"],
};

// Grid cell of each seat around the central board
const SEAT_CELL: Record<Seat, string> = {
  top: "col-start-2 row-start-1 justify-self-center",
  left: "col-start-1 row-start-2 self-center",
  right: "col-start-3 row-start-2 self-center",
  bottom: "col-start-2 row-start-3 justify-self-center",
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
  // Watching only: every player sits around the table, no hand, no action
  spectator?: boolean;
}

// Basic board: opponents on top, the table (draw pile and top card) in the
// middle, my hand at the bottom
export function GameBoard({ state, myId, spectator = false }: Props) {
  const {
    playCard,
    drawCard,
    callUno,
    catchUno,
    challengeBluff,
    acceptWildDraw4,
    turnStartedAt,
    turnEndsAt,
    unoCalls,
    unoEvent,
  } = useGame();
  // Time left and length of the turn, both from the server: a state that does
  // not change the turn (UNO call...) does not restart the countdown
  const turnLeft = useSecondsUntil(turnEndsAt);
  const turnSeconds = Math.max(1, Math.round(state.turnDurationMs / 1000));
  // The board, shaken when I take cards (ActionBursts)
  const board = useRef<HTMLDivElement>(null);
  // Room for my hand, and a hidden probe giving the width of a card
  const handBox = useRef<HTMLDivElement>(null);
  const cardProbe = useRef<HTMLDivElement>(null);
  const handLayout = useHandLayout(handBox, cardProbe);
  // A card waiting for a choice: its color (wild) or the player to swap with (7)
  const [asking, setAsking] = useState<{
    card: Card;
    kind: "color" | "target";
  } | null>(null);

  const me = state.players.find((player) => player.userId === myId);
  const turnPlayer = state.players.find((player) => player.isCurrentTurn);
  const seated = seatOpponents(state.players, myId);
  const myTurn = me?.isCurrentTurn ?? false;
  // On my turn the cards I can play rise, the others are dimmed; out of my
  // turn only a jump-in copy of the top card can rise
  const playable = playableCards(state, myId);
  const handCards = sortHand(me?.hand ?? []).map((card) =>
    toHandCard(card, playable.has(card.id), myTurn && !playable.has(card.id)),
  );
  // My turn, but no card fits: the draw pile insists
  const nothingToPlay =
    myTurn && !state.pendingWildDraw4 && playable.size === 0;
  // A big hand goes on several rows, the first ones behind. From 3 rows the
  // cards shrink (--card-w, from the base size --card-base).
  const handRows = splitIntoRows(handCards, handLayout);
  const scale = handScale(handRows.length);
  const rowsLayout = scaled(handLayout, scale);
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
    <div
      ref={board}
      className="relative isolate flex flex-1 flex-col justify-around gap-6 overflow-hidden rounded-[2rem] border-[6px] border-[#3a1d0e] bg-[radial-gradient(ellipse_at_50%_45%,var(--color-felt)_0%,#125a2c_45%,var(--color-felt-dark)_100%)] p-4 shadow-[inset_0_0_120px_rgb(0_0_0/0.6),0_0_0_3px_rgb(255_255_255/0.08),0_25px_60px_rgb(0_0_0/0.5)] compact:gap-3 compact:rounded-3xl compact:p-2 snug:gap-2 snug:p-1 short:gap-2 tiny:gap-1 tiny:rounded-2xl tiny:border-[3px] tiny:p-1"
    >
      {/* Felt grain, and the halo of the color to play */}
      <div
        aria-hidden="true"
        className="bg-felt pointer-events-none absolute inset-0 -z-10 opacity-50 mix-blend-overlay"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-[45%] left-1/2 -z-10 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-500 compact:size-80 ${GLOW[state.currentColor]}`}
      />
      {/* Opponents around the board: left, top and right. On a phone held
          upright they all sit in one row above the table. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-4 compact:gap-2 snug:gap-1 tiny:gap-1 phone:flex phone:flex-wrap phone:justify-center phone:gap-0.5">
        <>
          {seated.map(({ player, seat }) => (
            <div key={player.userId} className={SEAT_CELL[seat]}>
              <OpponentSeat
                player={player}
                canCatchUno={!spectator && unoAtRisk.includes(player.userId)}
                onCatchUno={() => catchUno(player.userId)}
              />
            </div>
          ))}
        </>

        {/* Central board */}
        <div className="col-start-2 row-start-2 phone:w-full phone:pt-2">
          <GameTable
            state={state}
            canDraw={myTurn && !state.pendingWildDraw4}
            mustDraw={nothingToPlay}
            onDraw={drawCard}
          />
        </div>
      </div>

      {/* Whose turn it is, between the table and my hand */}
      <TurnBar
        turnPlayer={turnPlayer}
        myTurn={myTurn}
        secondsLeft={turnPlayer ? timerFor(turnPlayer) : null}
        turnSeconds={turnSeconds}
        direction={state.direction}
      />

      {!spectator && (
        <>
          {/* Me: my hand, and the UNO button beside it while I can say it (I
          have only one card left then, so there is room for it) */}
          <div className="flex items-end justify-center gap-6 compact:gap-3 phone:flex-col phone:items-center phone:gap-1">
            {/* Me: avatar and name, glowing on my turn */}
            {me && (
              <div
                className={`mb-6 flex shrink-0 items-center gap-2 rounded-full bg-black/40 py-1 pr-4 pl-1 font-semibold compact:mb-2 snug:hidden phone:hidden ${
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

            {/* My hand: one row, or several when it is big (the first rows
            behind, only their top shows). --card-base: width of a card for
            this screen, --card-w: the width used (smaller for a big hand) */}
            <div
              ref={handBox}
              className="relative min-w-0 flex-1 pt-8 pb-2 [--card-base:min(9.75rem,16vw)] compact:pt-3 compact:pb-0 compact:[--card-base:min(5.5rem,16vw)] snug:pt-1 snug:[--card-base:min(4.5rem,16vw)] short:[--card-base:min(4.75rem,16vw)] tiny:pt-1 tiny:[--card-base:min(3.5rem,16vw)] phone:w-full phone:flex-none phone:pt-4 phone:[--card-base:min(5.5rem,20vw)]"
              style={
                {
                  "--card-w": `calc(var(--card-base) * ${scale})`,
                } as CSSProperties
              }
              data-anchor={`seat-${myId}`}
            >
              <div
                ref={cardProbe}
                aria-hidden="true"
                className="invisible absolute h-0 w-(--card-base)"
              />
              {handRows.map((row, index) => (
                <div
                  key={index}
                  style={
                    index > 0 ? { marginTop: rowLift(rowsLayout) } : undefined
                  }
                >
                  <Hand
                    cards={row}
                    fan="row"
                    arc
                    variant="game"
                    className="max-w-full"
                    overlap={rowOverlap(row.length, rowsLayout)}
                    cardClassName="w-(--card-w)"
                    onSelect={(id) => {
                      const card = me?.hand.find((c) => c.id === id);
                      if (card) play(card);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <CardFlights state={state} />

      <ActionBursts state={state} myId={myId} board={board} />

      <BluffDialog
        key={state.topCard.id}
        state={state}
        myId={myId}
        onChallenge={challengeBluff}
        onAccept={acceptWildDraw4}
      />

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
