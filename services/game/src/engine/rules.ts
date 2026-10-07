import type { Card, CardColor } from "shared";

export type CardEffect =
  | { type: "none" }
  | { type: "skip" }
  | { type: "reverse" }
  | { type: "draw"; count: number }
  | { type: "wild" }
  | { type: "wild_draw"; count: number };

export function isValidPlay(
  card: Card,
  topCard: Card,
  currentColor: CardColor,
): boolean {
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

export function getCardEffect(card: Card): CardEffect {
  switch (card.value) {
    case "skip":
      return { type: "skip" };
    case "reverse":
      return { type: "reverse" };
    case "draw2":
      return { type: "draw", count: 2 };
    case "wild":
      return { type: "wild" };
    case "wild_draw4":
      return { type: "wild_draw", count: 4 };
    default:
      return { type: "none" };
  }
}
