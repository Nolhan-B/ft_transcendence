import { createPortal } from "react-dom";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameState } from "shared";
import { Card } from "../cards/Card";
import { CardFace } from "./CardFace";

interface Props {
  state: GameState;
  myId: string;
  onChallenge: () => void;
  onAccept: () => void;
}

// Bluff rule: a Wild +4 waits for an answer from the next player. They see a
// pop-up to accept the 4 cards or challenge; the other players see who is
// deciding. Without an answer the server accepts the +4 when time runs out.
// To be rendered with key={state.topCard.id}: a new +4 starts afresh.
export function BluffDialog({ state, myId, onChallenge, onAccept }: Props) {
  const [answered, setAnswered] = useState(false);
  const pending = state.pendingWildDraw4;
  if (!pending) return null;

  const name = (id: string) =>
    state.players.find((p) => p.userId === id)?.username ?? "?";
  const bluffer = name(pending.playerId);
  // The bar empties with the time the server gives
  const countdown = {
    animationDuration: `${pending.timeLeftMs}ms`,
  } as CSSProperties;

  if (pending.targetId !== myId)
    return (
      <div className="animate-pop pointer-events-none absolute top-4 left-1/2 z-30 w-72 -translate-x-1/2 overflow-hidden rounded-box border border-white/15 bg-black/75 px-4 py-2 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-sm">
        {name(pending.targetId)} may challenge{" "}
        {pending.playerId === myId ? "your" : `${bluffer}'s`} +4...
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="animate-countdown h-full bg-accent"
            style={countdown}
          />
        </div>
      </div>
    );

  function answer(challenge: boolean) {
    setAnswered(true);
    if (challenge) onChallenge();
    else onAccept();
  }

  // In <body>, like the game effects (CardFlights, ActionBursts): inside the
  // game layout (isolate) the pop-up was drawn under them
  return createPortal(
    <dialog className="modal modal-open" aria-labelledby="bluff-title">
      <div className="modal-box animate-pop max-w-md text-center">
        <div className="mx-auto w-24 -rotate-6" aria-hidden="true">
          <Card variant="game">
            <CardFace color="wild" value="wild_draw4" />
          </Card>
        </div>

        <h3 id="bluff-title" className="text-display mt-4 text-3xl">
          {bluffer} hits you with a +4!
        </h3>
        <p className="mt-3 text-sm text-white/80">
          A Wild +4 is only allowed when its player has no card of the color in
          play. Think {bluffer} bluffed?
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
          <div className="rounded-box bg-black/25 p-3">
            <p className="font-bold">Accept</p>
            <p className="text-white/70">You draw 4 cards.</p>
          </div>
          <div className="rounded-box bg-black/25 p-3">
            <p className="font-bold text-accent">Challenge</p>
            <p className="text-white/70">
              Bluff: {bluffer} draws 4. Fair play: you draw 6.
            </p>
          </div>
        </div>

        {/* Time left to answer: then the +4 is accepted */}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="animate-countdown h-full bg-accent"
            style={countdown}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="btn btn-lg"
            disabled={answered}
            onClick={() => answer(false)}
          >
            Accept +4
          </button>
          <button
            type="button"
            className="btn btn-accent btn-lg"
            disabled={answered}
            onClick={() => answer(true)}
          >
            Challenge!
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
