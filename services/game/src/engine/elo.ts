export const ELO_K = 16;

export function computeEloChanges(
  ranking: { userId: string; elo: number }[],
): { userId: string; oldElo: number; newElo: number }[] {
  const n = ranking.length;
  if (n < 2) {
    return ranking.map((p) => ({
      userId: p.userId,
      oldElo: p.elo,
      newElo: p.elo,
    }));
  }

  const k = ELO_K / (n - 1);
  const deltas = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const prob = probabilityToDefeat(ranking[i].elo, ranking[j].elo);

      deltas[i] += k * (1 - prob);
      deltas[j] += k * (0 - (1 - prob));
    }
  }

  return ranking.map((p, i) => ({
    userId: p.userId,
    oldElo: p.elo,
    newElo: Math.max(0, Math.round(p.elo + deltas[i])),
  }));
}

function probabilityToDefeat(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}
