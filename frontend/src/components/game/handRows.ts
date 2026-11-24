import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

// Part of a card that must stay visible in a row of overlapping cards. Below
// that, the hand goes on a new row.
const MIN_VISIBLE = 0.45;
// Part of a card visible when there is plenty of room
const MAX_VISIBLE = 0.7;

export interface HandLayout {
  // Room for the hand and width of one card, in pixels (0: not measured yet)
  width: number;
  cardWidth: number;
}

// Measures the room for my hand and the width of a card (a hidden probe of
// the card width), again when the window changes size
export function useHandLayout(
  box: RefObject<HTMLElement | null>,
  probe: RefObject<HTMLElement | null>,
): HandLayout {
  const [layout, setLayout] = useState<HandLayout>({ width: 0, cardWidth: 0 });

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      // A margin: the arc of the hand turns the cards at the ends
      const width = element.clientWidth * 0.88;
      const cardWidth = probe.current?.offsetWidth ?? 0;
      setLayout((old) =>
        old.width === width && old.cardWidth === cardWidth
          ? old
          : { width, cardWidth },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [box, probe]);

  return layout;
}

// Splits a hand into rows of the same size (the first rows a card longer),
// as few rows as possible while each card keeps MIN_VISIBLE of it visible
export function splitIntoRows<T>(cards: T[], layout: HandLayout): T[][] {
  const { width, cardWidth } = layout;
  if (!width || !cardWidth || cards.length === 0) return [cards];
  const perRow = Math.max(
    3,
    Math.floor(1 + (width - cardWidth) / (cardWidth * MIN_VISIBLE)),
  );
  const rows = Math.ceil(cards.length / perRow);
  const size = Math.ceil(cards.length / rows);
  return Array.from({ length: rows }, (_, i) =>
    cards.slice(i * size, (i + 1) * size),
  );
}

// Negative margin between two cards of a row of "count" cards: as much of
// each card as possible is shown, MAX_VISIBLE at most
export function rowOverlap(count: number, layout: HandLayout): string {
  const { width, cardWidth } = layout;
  if (!width || !cardWidth || count < 2) return `${-cardWidth * 0.3}px`;
  const visible = Math.min(
    cardWidth * MAX_VISIBLE,
    (width - cardWidth) / (count - 1),
  );
  return `${visible - cardWidth}px`;
}

// Size of the cards for a hand of "rows" rows: from 3 rows the cards shrink,
// so that the hand still fits on the screen (a phone held upright...)
export function handScale(rows: number): number {
  return rows <= 2 ? 1 : rows === 3 ? 0.8 : 0.7;
}

// The layout once the cards are scaled
export function scaled(layout: HandLayout, scale: number): HandLayout {
  return { width: layout.width, cardWidth: layout.cardWidth * scale };
}

// A row behind another one shows only its top part
export function rowLift(layout: HandLayout): string {
  const cardHeight = (layout.cardWidth * 87) / 56;
  return `${-cardHeight * 0.58}px`;
}
