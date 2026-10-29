import { Card, CardColor, StackingRule } from "shared";
import { isValidPlay } from "./rules.js";

export function chooseCard(
  hand: Card[],
  topCard: Card,
  currentColor: CardColor,
  pendingDrawCount: number,
  StackingRule: StackingRule,
): Card | null {
  const playableCards = hand.filter((c) =>
    isValidPlay(c, topCard, currentColor, pendingDrawCount, StackingRule),
  );

  if (pendingDrawCount > 0) {
    let stackCards: Card[] = [];
    if (StackingRule === "same") {
      stackCards = playableCards.filter((c) => c.value === topCard.value);
    } else if (StackingRule === "all") {
      stackCards = playableCards.filter(
        (c) => c.value === "draw2" || c.value === "wild_draw4",
      );
    }

    if (stackCards.length > 0) {
      return Math.random() > 0.05
        ? stackCards[Math.floor(Math.random() * stackCards.length)]
        : null;
    }
    return null;
  }

  if (playableCards.length === 0) return null;

  const actions = playableCards.filter((c) =>
    ["skip", "reverse", "draw2"].includes(c.value),
  );
  const normals = playableCards.filter(
    (c) =>
      c.color !== "wild" && !["skip", "reverse", "draw2"].includes(c.value),
  );
  const wilds = playableCards.filter((c) => c.color === "wild");

  const priority = [...actions, ...normals, ...wilds];

  if (Math.random() > 0.3) {
    return priority[0];
  }
  return playableCards[Math.floor(Math.random() * playableCards.length)];
}

export function chooseColor(hand: Card[]): CardColor {
  const colors: CardColor[] = ["red", "blue", "green", "yellow"];
  let bestColor: CardColor = "red";
  let max = 0;
  for (const color of colors) {
    const count = hand.filter((c) => c.color === color).length;
    if (count > max) {
      max = count;
      bestColor = color;
    }
  }
  return bestColor;
}

export function shouldChallengeBluff(
  hand: Card[],
  currentColor: CardColor,
): boolean {
  const cardFromCurrentColor = hand.filter((c) => c.color === currentColor);
  if (cardFromCurrentColor.length >= 1) return Math.random() > 0.3;
  return Math.random() > 0.7;
}

export function shouldCallUno(hand: Card[]): boolean {
  if (hand.length !== 1) return false;
  return Math.random() > 0.1;
}
