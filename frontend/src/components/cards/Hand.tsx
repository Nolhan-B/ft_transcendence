import type { CSSProperties, ReactNode } from "react";
import { Card } from "./Card";
import type { CardColor, CardVariant } from "./Card";

export interface HandCard {
  id: string;
  color: CardColor;
  label: string; // accessible name, used when the card is clickable
  content?: ReactNode; // shown in the card's central panel
  disabled?: boolean; // visible but not clickable (not your turn...)
  highlight?: boolean; // playable right now: raised and outlined
  dimmed?: boolean; // darker (not playable while the player could play)
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
  // "row": flat horizontal row, the cards overlap by `overlap` (a CSS length
  // per card after the first, negative margin) and never rotate.
  fan?: "center" | "left" | "row";
  overlap?: string;
  // "row" only: the row bends into a light arc, like cards held in a hand
  arc?: boolean;
  variant?: CardVariant; // look of the cards (default: classic)
  cardClassName?: string; // added to every card (e.g. a thinner border)
  className?: string; // width of the cards (default: 3/4 of the space on mobile, capped so that a card fits the screen height)
}

// A hand of UNO cards, fanned out around their bottom edge.
export function Hand({
  cards,
  selectedId,
  onSelect,
  step = 10,
  fan = "center",
  overlap = "-2rem",
  arc = false,
  variant = "classic",
  cardClassName = "",
  className = "w-3/4 max-w-[max(14rem,min(24rem,calc((100dvh_-_9rem)*56/87)))] sm:w-full",
}: HandProps) {
  const selectedIndex = cards.findIndex((card) => card.id === selectedId);

  if (fan === "row") {
    return (
      <div className={`flex items-end justify-center ${className}`}>
        {cards.map((card, index) => {
          const clickable = onSelect !== undefined && !card.disabled;
          // Arc: the cards turn around a point below the hand, the ones at
          // the ends a little lower
          const offset = index - (cards.length - 1) / 2;
          const spread = Math.min(3, 24 / Math.max(cards.length, 1));
          // Playable cards rise out of the hand, the others sink a little
          const lift = card.highlight
            ? "1rem"
            : card.dimmed
              ? "-0.4rem"
              : "0px";
          const bend = arc
            ? ({
                "--rot": `${offset * spread}deg`,
                "--drop": `calc(${Math.abs(offset) ** 1.6 * 0.12 * spread}px - ${lift})`,
              } as CSSProperties)
            : undefined;
          return (
            <Card
              key={card.id}
              color={card.color}
              variant={variant}
              style={{ ...bend, ...(index > 0 ? { marginLeft: overlap } : {}) }}
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
              className={`shrink-0 transition-all duration-300 ${
                arc
                  ? "origin-[50%_130%] [rotate:var(--rot)] [translate:0_var(--drop)]"
                  : ""
              } ${cardClassName} ${
                card.dimmed
                  ? "brightness-[0.5] saturate-[0.6]"
                  : card.disabled
                    ? "brightness-[0.75]"
                    : ""
              } ${
                card.highlight
                  ? "shadow-[0_0_0_3px_var(--color-accent),0_0_24px_var(--color-accent)]"
                  : ""
              } ${
                clickable
                  ? arc
                    ? "cursor-pointer hover:z-10 hover:[translate:0_calc(var(--drop)-2rem)] hover:scale-[1.06] hover:shadow-[0_0_0_3px_var(--color-accent),0_14px_28px_rgb(0_0_0/0.45)]"
                    : "cursor-pointer hover:z-10 hover:-translate-y-3"
                  : ""
              }`}
            >
              {card.content}
            </Card>
          );
        })}
      </div>
    );
  }

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
        const clickable = onSelect !== undefined && !selected && !card.disabled;

        return (
          <Card
            key={card.id}
            color={card.color}
            variant={variant}
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
            className={`col-start-1 row-start-1 origin-bottom transition-all duration-300 [rotate:var(--angle)] ${cardClassName} ${
              card.disabled ? "brightness-75" : ""
            } ${
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
