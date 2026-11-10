import type { CSSProperties, ReactNode } from "react";
import { Card } from "./Card";
import type { CardColor } from "./Card";

export interface HandCard {
  id: string;
  color: CardColor;
  label: string; // accessible name, used when the card is clickable
  content?: ReactNode; // shown in the card's central panel
}

interface HandProps {
  cards: HandCard[];
  // The fan is always symmetrical and never moves. The selected card, if any,
  // is straightened and brought to the front (auth page).
  selectedId?: string;
  onSelect?: (id: string) => void;
  step?: number; // angle between two cards, in degrees
  // "center": symmetrical fan (game). "left": the last card is the base and
  // the others fan out to its left (auth page).
  fan?: "center" | "left";
  className?: string; // width of the cards (default: 3/4 of the space on mobile, capped so that a card fits the screen height)
}

// A hand of UNO cards, fanned out around their bottom edge.
export function Hand({
  cards,
  selectedId,
  onSelect,
  step = 10,
  fan = "center",
  className = "w-3/4 max-w-[max(14rem,min(24rem,calc((100dvh_-_9rem)*56/87)))] sm:w-full",
}: HandProps) {
  const selectedIndex = cards.findIndex((card) => card.id === selectedId);

  return (
    // All cards share the same grid cell, so they stack on each other
    <div
      className={`grid [--fan:0.6] sm:[--fan:1] ${
        // leave room on the left for the cards that swing out that way
        fan === "left" ? "translate-x-[calc(27%*var(--fan))]" : ""
      } ${className}`}
    >
      {cards.map((card, index) => {
        const selected = index === selectedIndex;
        const pivot =
          fan === "left" ? cards.length - 1 : (cards.length - 1) / 2;
        const angle = selected ? 0 : (index - pivot) * step;
        const clickable = onSelect !== undefined && !selected;

        return (
          <Card
            key={card.id}
            color={card.color}
            style={
              { "--angle": `calc(${angle}deg * var(--fan))` } as CSSProperties
            }
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? card.label : undefined}
            title={clickable ? card.label : undefined}
            onClick={clickable ? () => onSelect(card.id) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(card.id);
                  }
                : undefined
            }
            className={`col-start-1 row-start-1 origin-bottom transition-all duration-300 [rotate:var(--angle)] ${
              selected
                ? "z-10 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px] hover:shadow-primary/50"
                : `z-0 ${
                    clickable
                      ? "cursor-pointer hover:-translate-y-3 hover:[rotate:calc(var(--angle)+3deg)]"
                      : ""
                  }`
            }`}
          >
            {card.content}
          </Card>
        );
      })}
    </div>
  );
}
