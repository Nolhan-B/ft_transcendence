import { PrismaClient } from '../generated/prisma/client.js';
import type { Profile } from 'shared';
import { FriendshipStatus } from 'shared';

export async function getFriends(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile[]> {
  if (!userId) return [];

  const sent = await prisma.friendship.findMany({
    where: { userId: userId, status: FriendshipStatus.ACCEPTED },
    include: {
      friend: {
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
      },
    },
  });

  const sentProfiles = sent.map((f) => ({
    id: f.friend.id,
    username: f.friend.username,
    avatarUrl: f.friend.avatarUrl,
    createdAt: f.friend.createdAt.toISOString(),
  }));

  const received = await prisma.friendship.findMany({
    where: { friendId: userId, status: FriendshipStatus.ACCEPTED },
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
      },
    },
  });

  const receivedProfiles = received.map((f) => ({
    id: f.user.id,
    username: f.user.username,
    avatarUrl: f.user.avatarUrl,
    createdAt: f.user.createdAt.toISOString(),
  }));

  return [...sentProfiles, ...receivedProfiles];
}
