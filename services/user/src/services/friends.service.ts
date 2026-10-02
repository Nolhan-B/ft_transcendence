import { DbNullClass } from '@prisma/client/runtime/client';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Profile, Friendship } from 'shared';
import { FriendshipStatus } from 'shared';

export async function getFriends(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile[]> {
  const sent = await getSent(prisma, userId, FriendshipStatus.ACCEPTED);
  const received = await getReceived(prisma, userId, FriendshipStatus.ACCEPTED);
  return [...sent, ...received];
}

export async function getReceivedPendingRequests(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile[]> {
  return getReceived(prisma, userId, FriendshipStatus.PENDING);
}

export async function getSentPendingRequests(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile[]> {
  return getSent(prisma, userId, FriendshipStatus.PENDING);
}

export async function sendFriendRequest(
  prisma: PrismaClient,
  userId: string,
  friendId: string,
): Promise<Friendship | null> {
  if (!userId || !friendId) return null;

  const friendship = await prisma.friendship.create({
    data: { userId, friendId },
  });

  if (!friendship) return null;

  return {
    id: friendship.id,
    userId: friendship.userId,
    friendId: friendship.friendId,
    status: friendship.status as FriendshipStatus,
    createdAt: friendship.createdAt.toISOString(),
  };
}

export async function acceptFriendRequest(
  prisma: PrismaClient,
  userId: string,
  friendId: string,
): Promise<Friendship | null> {
  if (!userId || !friendId) return null;

  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { friendId, userId } },
  });

  if (!friendship) return null;

  if (friendship.status == FriendshipStatus.ACCEPTED) return null;

  const updatedFriendship = await prisma.friendship.update({
    where: { id: friendship.id },
    data: { status: FriendshipStatus.ACCEPTED },
  });

  if (!updatedFriendship) return null;

  return {
    id: updatedFriendship.id,
    userId: updatedFriendship.userId,
    friendId: updatedFriendship.friendId,
    status: updatedFriendship.status as FriendshipStatus,
    createdAt: updatedFriendship.createdAt.toISOString(),
  };
}

////// fonction helpeuse

async function getSent(
  prisma: PrismaClient,
  userId: string,
  status: FriendshipStatus,
): Promise<Profile[]> {
  const results = await prisma.friendship.findMany({
    where: { userId, status },
    include: {
      friend: {
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
      },
    },
  });
  return results.map((f) => mapToProfile(f.friend));
}

async function getReceived(
  prisma: PrismaClient,
  userId: string,
  status: FriendshipStatus,
): Promise<Profile[]> {
  const results = await prisma.friendship.findMany({
    where: { friendId: userId, status },
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
      },
    },
  });
  return results.map((f) => mapToProfile(f.user));
}

function mapToProfile(user: {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
}): Profile {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
