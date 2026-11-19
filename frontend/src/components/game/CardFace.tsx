import type { CardValue } from "shared";

const SYMBOLS: Partial<Record<CardValue, string>> = {
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "★",
  wild_draw4: "+4",
};

// Content of a card, sized with the card width (container query units)
export function CardFace({ value }: { value: CardValue }) {
  return (
    <span className="block text-center text-[38cqw] leading-none font-black">
      {SYMBOLS[value] ?? value}
    </span>
  );
}

export function CardBack() {
  return (
    <span className="block text-center text-[20cqw] leading-none font-black tracking-widest">
      UNO
    </span>
  );
}
