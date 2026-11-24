import { useSyncExternalStore } from "react";

// Colors of the table (page background, panels, pop-ups). The values live in
// styles/index.css, under :root[data-table="..."]. The four card colors do
// not change.
export const TABLE_COLORS = [
  { id: "midnight", label: "Midnight", swatch: ["#4c3fc2", "#0a0822"] },
  { id: "crimson", label: "Crimson", swatch: ["#d32f2f", "#2a0505"] },
  { id: "ocean", label: "Ocean", swatch: ["#0e7490", "#03141c"] },
  { id: "plum", label: "Plum", swatch: ["#9333ea", "#14031f"] },
  { id: "graphite", label: "Graphite", swatch: ["#52525b", "#09090b"] },
] as const;

export type TableColor = (typeof TABLE_COLORS)[number]["id"];

const KEY = "sns-table-color";
const DEFAULT: TableColor = "midnight";
const listeners = new Set<() => void>();

function stored(): TableColor {
  try {
    const id = localStorage.getItem(KEY);
    if (TABLE_COLORS.some((color) => color.id === id)) return id as TableColor;
  } catch {
    // no storage (private window...): the default color
  }
  return DEFAULT;
}

let current = stored();

function apply(color: TableColor) {
  document.documentElement.dataset.table = color;
}

// Called once before the first render, so the page never flashes another color
export function applyStoredTableColor() {
  apply(current);
}

export function setTableColor(color: TableColor) {
  current = color;
  apply(color);
  try {
    localStorage.setItem(KEY, color);
  } catch {
    // kept for this visit only
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTableColor(): TableColor {
  return useSyncExternalStore(subscribe, () => current);
}
