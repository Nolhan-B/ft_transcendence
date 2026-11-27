import { PrismaClient } from "shared";
import type { LeaderboardEntry } from "shared";

// Public fields only
const ENTRY_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  elo: true,
} as const;

// Exclude bot entries from leaderboard rankings
const REAL_PLAYER_WHERE = {
  NOT: { id: { startsWith: "bot_" } },
};

export async function getTopPlayers(
  prisma: PrismaClient,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: REAL_PLAYER_WHERE,
    // Break ELO ties deterministically using creation date, then ID
    orderBy: [{ elo: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: ENTRY_SELECT,
  });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < users.length; i++) {
    const previous = entries[i - 1];
    // Assign the same rank to players with equal ELO
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

  // Count only real players with a strictly higher ELO
  const better = await prisma.user.count({
    where: {
      ...REAL_PLAYER_WHERE,
      elo: { gt: user.elo },
    },
  });
  return { rank: better + 1, ...user };
}
