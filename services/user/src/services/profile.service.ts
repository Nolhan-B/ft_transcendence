import { PrismaClient } from '../generated/prisma/client.js';
import type { Profile } from 'shared';

export async function getProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
