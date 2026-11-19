import type { Card } from "shared";
import type { HandCard } from "../cards/Hand";
import { CardFace } from "./CardFace";
import { cardName, themeColor } from "./cards";

// A card of the game, as the Hand component wants it
export function toHandCard(card: Card, disabled: boolean): HandCard {
  return {
    id: card.id,
    color: themeColor(card.color),
    label: `Play ${cardName(card)}`,
    content: <CardFace value={card.value} />,
    disabled,
  };
}
