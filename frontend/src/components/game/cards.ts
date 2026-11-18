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

// Accessible name of a card, e.g. "red 7" or "wild draw four"
export function cardName(card: Pick<Card, "color" | "value">): string {
  const value = NAMES[card.value] ?? card.value;
  return card.color === "wild" ? value : `${card.color} ${value}`;
}
