import type { Card, GameState } from "shared";

// Same test as isValidPlay in the game service (engine/rules.ts): keep both
// in sync. Only used to highlight the cards; the server still decides.
function isValidPlay(card: Card, state: GameState): boolean {
  const { topCard, currentColor, pendingDrawCount, settings } = state;
  if (pendingDrawCount > 0) {
    if (settings.stacking === "none") return false;
    if (settings.stacking === "same") return card.value === topCard.value;
    return card.value === "draw2" || card.value === "wild_draw4";
  }
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  return card.value === topCard.value;
}

// The ids of my cards I can play right now: on my turn, the valid cards; out
// of my turn, only an exact copy of the top card (jump-in rule). Nothing
// while a Wild +4 waits for an answer.
export function playableCards(state: GameState, myId: string): Set<string> {
  const me = state.players.find((player) => player.userId === myId);
  const playable = new Set<string>();
  if (!me || me.disconnected || state.pendingWildDraw4) return playable;

  for (const card of me.hand) {
    if (me.isCurrentTurn) {
      if (isValidPlay(card, state)) playable.add(card.id);
    } else if (
      state.settings.jumpIn &&
      card.color === state.topCard.color &&
      card.value === state.topCard.value &&
      isValidPlay(card, state)
    ) {
      playable.add(card.id);
    }
  }
  return playable;
}
