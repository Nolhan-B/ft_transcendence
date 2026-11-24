import { useSyncExternalStore } from "react";
import type { Skin, SkinId } from "./common";
import { SNS_SKIN } from "./sns";
import { GAMEBOY_SKIN } from "./gameboy";
import { WIN95_SKIN } from "./win95";
import { UKIYOE_SKIN } from "./ukiyoe";
import { RISO_SKIN } from "./riso";
import { DECO_SKIN } from "./deco";
import { POPART_SKIN } from "./popart";
import { PAPERCUT_SKIN } from "./papercut";

export const SKINS: Skin[] = [
  SNS_SKIN,
  GAMEBOY_SKIN,
  WIN95_SKIN,
  UKIYOE_SKIN,
  RISO_SKIN,
  DECO_SKIN,
  POPART_SKIN,
  PAPERCUT_SKIN,
];

// The chosen skin is a preference of this browser only: it changes nothing
// for the other players, so it lives in localStorage
const KEY = "sns-card-skin";
const listeners = new Set<() => void>();

function stored(): SkinId {
  try {
    const id = localStorage.getItem(KEY);
    if (SKINS.some((skin) => skin.id === id)) return id as SkinId;
  } catch {
    // no storage (private window...): the default skin
  }
  return SNS_SKIN.id;
}

let current = stored();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the skin
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    current = stored();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setCardSkin(id: SkinId) {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // kept for this visit only
  }
  listeners.forEach((listener) => listener());
}

// The skin every card of the site is drawn with
export function useCardSkin(): Skin {
  const id = useSyncExternalStore(subscribe, () => current);
  return SKINS.find((skin) => skin.id === id) ?? SNS_SKIN;
}

export type { Skin, SkinId } from "./common";
export { NATIVE_H, NATIVE_W } from "./common";
