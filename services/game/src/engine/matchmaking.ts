export const TARGET_PLAYERS = 4;
export const BASE_RANGE = 100;
export const RANGE_STEP = 50;
export const RANGE_STEP_MS = 10_000;
export const MAX_RANGE = 500;

export interface QueueEntry {
  userId: string;
  username: string;
  elo: number;
  joinedAt: number; // Date.now() lors de l'entree dans la file
}

function isValidGroup(group: QueueEntry[], now: number): boolean {
  const elos = group.map((e) => e.elo);
  const spread = Math.max(...elos) - Math.min(...elos);
  const smallestRange = Math.min(...group.map((e) => eloRange(e, now)));
  return spread <= smallestRange;
}

export function findMatch(
  queue: QueueEntry[],
  now: number,
): QueueEntry[] | null {
  const sorted = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);

  for (const anchor of sorted) {
    const candidates = sorted
      .filter((e) => e.userId !== anchor.userId)
      .sort(
        (a, b) => Math.abs(a.elo - anchor.elo) - Math.abs(b.elo - anchor.elo),
      );

    const group: QueueEntry[] = [anchor];

    for (const candidate of candidates) {
      if (group.length === TARGET_PLAYERS) break;
      if (isValidGroup([...group, candidate], now)) group.push(candidate);
    }

    if (group.length >= minPlayers(anchor, now)) return group;
  }

  return null;
}

// Ecart d'ELO accepte par ce joueur, qui s'elargit avec l'attente
export function eloRange(entry: QueueEntry, now: number): number {
  const steps = Math.floor((now - entry.joinedAt) / RANGE_STEP_MS);
  return Math.min(BASE_RANGE + steps * RANGE_STEP, MAX_RANGE);
}

// Taille minimale de partie acceptee par ce joueur
export function minPlayers(entry: QueueEntry, now: number): number {
  const waited = now - entry.joinedAt;
  if (waited >= 40_000) return 2;
  if (waited >= 20_000) return 3;
  return TARGET_PLAYERS;
}
