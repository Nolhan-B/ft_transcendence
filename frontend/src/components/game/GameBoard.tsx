import { useState } from "react";
import type { Card, CardColor, GameState, Player } from "shared";
import { useGame } from "../../hooks/ws/useGame";
import { ChoiceDialog } from "./ChoiceDialog";
import { GameTable } from "./GameTable";
import { OpponentSeat } from "./OpponentSeat";
import type { Seat } from "./OpponentSeat";
import { PlayingCard } from "./PlayingCard";

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
  const { playCard, drawCard, callUno, catchUno } = useGame();
  // A card waiting for a choice: its color (wild) or the player to swap with (7)
  const [asking, setAsking] = useState<{
    card: Card;
    kind: "color" | "target";
  } | null>(null);

  const me = state.players.find((player) => player.userId === myId);
  const seated = seatOpponents(state.players, myId);
  const opponents = seated.map(({ player }) => player);
  const myTurn = me?.isCurrentTurn ?? false;
  const unoCallout = state.settings.unoCallout;

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
    <div className="flex flex-col gap-6">
      {/* Opponents around the board: left, top and right */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-4 short:gap-2">
        <>
          {seated.map(({ player, seat }) => (
            <div key={player.userId} className={SEAT_CELL[seat]}>
              <OpponentSeat
                player={player}
                seat={seat}
                canCatchUno={unoCallout && player.hand.length === 1}
                onCatchUno={() => catchUno(player.userId)}
              />
            </div>
          ))}
        </>

        {/* Central board */}
        <div className="col-start-2 row-start-2">
          <GameTable state={state} myTurn={myTurn} onDraw={drawCard} />
        </div>
      </div>

      {/* My hand, at the bottom */}
      <div className="flex flex-col items-center gap-4 short:gap-1">
        <div className="flex items-center gap-3">
          {myTurn ? (
            <span className="badge badge-accent badge-lg">Your turn</span>
          ) : (
            <span className="badge badge-ghost badge-lg">Waiting...</span>
          )}
          {unoCallout && me && me.hand.length <= 2 && (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={callUno}
            >
              UNO!
            </button>
          )}
        </div>

        <div className="flex max-w-full flex-wrap justify-center gap-2 short:flex-nowrap short:justify-start short:gap-0 short:-space-x-5 short:overflow-x-auto short:px-2 short:pt-2">
          {me?.hand.map((card) => (
            <PlayingCard
              key={card.id}
              color={card.color}
              value={card.value}
              size="md"
              disabled={!myTurn && !state.settings.jumpIn}
              onClick={() => play(card)}
            />
          ))}
        </div>
      </div>

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
