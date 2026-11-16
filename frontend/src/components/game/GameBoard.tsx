import { useState } from "react";
import type { Card, CardColor, GameState } from "shared";
import { useGame } from "../../hooks/ws/useGame";
import { UserAvatar } from "../user/UserAvatar";
import { ChoiceDialog } from "./ChoiceDialog";
import { PlayingCard } from "./PlayingCard";

const COLOR_CHOICES: { color: CardColor; label: string; button: string }[] = [
  { color: "red", label: "Red", button: "btn-primary" },
  { color: "yellow", label: "Yellow", button: "btn-accent" },
  { color: "green", label: "Green", button: "btn-success" },
  { color: "blue", label: "Blue", button: "btn-secondary" },
];

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
  const opponents = state.players.filter((player) => player.userId !== myId);
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
      {/* Opponents */}
      <div className="flex flex-wrap justify-center gap-4">
        {opponents.map((player) => (
          <div
            key={player.userId}
            className={`card bg-base-200 shadow-xl ${
              player.isCurrentTurn ? "ring-4 ring-accent" : ""
            } ${player.disconnected ? "opacity-40" : ""}`}
          >
            <div className="card-body items-center gap-2 p-4">
              <UserAvatar username={player.username} size="md" />
              <span className="font-semibold">{player.username}</span>
              <span className="badge badge-outline">
                {player.hand.length} cards
              </span>
              {unoCallout && player.hand.length === 1 && (
                <button
                  type="button"
                  className="btn btn-warning btn-xs"
                  onClick={() => catchUno(player.userId)}
                >
                  Catch UNO
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex flex-wrap items-center justify-center gap-8 rounded-box bg-base-200 p-6 shadow-inner">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!myTurn}
            onClick={drawCard}
            className="cursor-pointer transition-transform enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Draw a card"
          >
            <PlayingCard faceDown size="md" />
          </button>
          <span className="badge badge-outline">
            {state.pendingDrawCount > 0
              ? `Draw ${state.pendingDrawCount}`
              : `Draw (${state.drawPileCount})`}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <PlayingCard
            color={state.topCard.color}
            value={state.topCard.value}
            size="lg"
          />
          <span className="badge badge-outline">Top card</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span>Color</span>
            <PlayingCard color={state.currentColor} size="sm" />
          </div>
          <span className="text-2xl" title="Direction of play">
            {state.direction === 1 ? "↻" : "↺"}
          </span>
        </div>
      </div>

      {/* My hand */}
      <div className="flex flex-col items-center gap-4">
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

        <div className="flex flex-wrap justify-center gap-2">
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
