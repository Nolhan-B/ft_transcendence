import type { Card, CardColor as GameColor, CardValue } from "shared";
import type { CardColor } from "../cards/Card";

// Game colors to the theme colors used by the Card component
const COLORS: Record<GameColor, CardColor> = {
  red: "primary",
  blue: "secondary",
  yellow: "accent",
  green: "success",
  wild: "neutral",
};

const NAMES: Partial<Record<CardValue, string>> = {
  skip: "skip",
  reverse: "reverse",
  draw2: "draw two",
  wild: "wild",
  wild_draw4: "wild draw four",
};

export const themeColor = (color: GameColor): CardColor => COLORS[color];

// Order of a sorted hand: by color, then by value, the wild cards last
const COLOR_ORDER: GameColor[] = ["red", "yellow", "green", "blue", "wild"];
const VALUE_ORDER: CardValue[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "skip",
  "reverse",
  "draw2",
  "wild",
  "wild_draw4",
];

// A sorted copy of a hand. Sorting on every new state keeps the hand in
// order from the deal on, and puts each drawn card in its place.
export function sortHand<T extends Pick<Card, "color" | "value">>(
  hand: T[],
): T[] {
  return [...hand].sort(
    (a, b) =>
      COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) ||
      VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value),
  );
}

// Accessible name of a card, e.g. "red 7" or "wild draw four"
export function cardName(card: Pick<Card, "color" | "value">): string {
  const value = NAMES[card.value] ?? card.value;
  return card.color === "wild" ? value : `${card.color} ${value}`;
}
