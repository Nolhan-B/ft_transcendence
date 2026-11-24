import type { FC } from "react";
import type { CardValue } from "shared";

// A skin draws a card at its native size, NATIVE_W x NATIVE_H pixels (the
// 56x87 ratio of a real card). The Card component scales it to its width.
export const NATIVE_W = 224;
export const NATIVE_H = 348;

export type SuitColor = "red" | "yellow" | "green" | "blue";
export type SuitValue = Exclude<CardValue, "wild" | "wild_draw4">;
export type WildValue = "wild" | "wild_draw4";
export type ActionValue = "skip" | "reverse" | "draw2";

export const SUITS: SuitColor[] = ["red", "yellow", "green", "blue"];

export const COLOR_NAME: Record<SuitColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

export const ACTION_NAME: Record<ActionValue, string> = {
  skip: "Skip",
  reverse: "Reverse",
  draw2: "Draw 2",
};

export const isAction = (value: SuitValue): value is ActionValue =>
  value === "skip" || value === "reverse" || value === "draw2";

// Text drawn for a value: the number, or a sign for the action cards
export const glyph = (value: SuitValue): string =>
  value === "skip"
    ? "⊘"
    : value === "reverse"
      ? "⇄"
      : value === "draw2"
        ? "+2"
        : value;

export const valueLabel = (value: SuitValue): string =>
  isAction(value) ? ACTION_NAME[value] : `No. ${value}`;

// Root of every skin card: fills the native box
export const SKIN_ROOT =
  "relative flex size-full flex-col overflow-hidden select-none";

export interface FaceProps {
  color: SuitColor;
  value: SuitValue;
}

export interface WildProps {
  value: WildValue;
}

export type SkinId =
  | "sns"
  | "gameboy"
  | "win95"
  | "ukiyoe"
  | "riso"
  | "deco"
  | "popart"
  | "papercut";

export interface Skin {
  id: SkinId;
  label: string;
  subtitle: string;
  // Color of the skin in the picker
  accent: string;
  Face: FC<FaceProps>;
  Wild: FC<WildProps>;
  Back: FC;
}
