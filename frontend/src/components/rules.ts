import type { GameSettings } from "../types";

export const RULE_INFO: { key: keyof GameSettings; label: string; desc: string }[] = [
  { key: "stacking", label: "Stacking", desc: "Answer a +2 / +4 with another draw card" },
  { key: "sevenZeroRule", label: "7-0", desc: "7 swaps hands with a player, 0 rotates all hands" },
  { key: "jumpIn", label: "Jump-in", desc: "Play an identical card out of turn" },
  { key: "bluffChallenge", label: "Bluff", desc: "Challenge a +4 if you think it was illegal" },
  { key: "unoCallout", label: "UNO call", desc: "Forget to call UNO and get caught = +2" },
];

export function activeRules(s: GameSettings): string[] {
  const out: string[] = [];
  if (s.stacking !== "none") out.push(s.stacking === "all" ? "Stack all" : "Stack same");
  if (s.sevenZeroRule) out.push("7-0");
  if (s.jumpIn) out.push("Jump-in");
  if (s.bluffChallenge) out.push("Bluff");
  if (s.unoCallout) out.push("UNO call");
  return out;
}
