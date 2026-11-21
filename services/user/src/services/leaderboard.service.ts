import { PrismaClient } from "shared";
import type { LeaderboardEntry } from "shared";

// Uniquement des champs publics
const ENTRY_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  elo: true,
} as const;

export async function getTopPlayers(
  prisma: PrismaClient,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    // createdAt départage l'ordre d'affichage des égalités, pour qu'il soit stable
    orderBy: [{ elo: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: ENTRY_SELECT,
  });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < users.length; i++) {
    const previous = entries[i - 1];
    // À ELO égal, même rang que le joueur précédent
    const rank =
      previous && previous.elo === users[i].elo ? previous.rank : i + 1;
    entries.push({ rank, ...users[i] });
  }
  return entries;
}

export async function getPlayerRank(
  prisma: PrismaClient,
  userId: string,
): Promise<LeaderboardEntry | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ENTRY_SELECT,
  });
  if (!user) return null;

  const better = await prisma.user.count({ where: { elo: { gt: user.elo } } });
  return { rank: better + 1, ...user };
}
