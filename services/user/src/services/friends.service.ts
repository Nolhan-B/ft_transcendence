import { Prisma, PrismaClient } from "shared";
import type {
  Profile,
  Friendship,
  FriendshipWithFriend,
  FriendshipWithUser,
} from "shared";
import { FriendshipStatus } from "shared";

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
  // Prevent missing IDs or self-friend requests
  if (!userId || !friendId || userId === friendId) return null;

  // Use a serializable transaction to prevent bidirectional race conditions (A->B and B->A simultaneously)
  return prisma.$transaction(
    async (tx) => {
      // Check if either user has blocked the other
      const blocked = await tx.blockedFriendship.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: friendId },
            { blockerId: friendId, blockedId: userId },
          ],
        },
      });
      if (blocked) return null;

      // Check if a friendship or pending request already exists in either direction
      const existing = await tx.friendship.findFirst({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      });
      if (existing) return null;

      const friendship = await tx.friendship.create({
        data: { userId, friendId },
      });

      return {
        id: friendship.id,
        userId: friendship.userId,
        friendId: friendship.friendId,
        status: friendship.status as FriendshipStatus,
        createdAt: friendship.createdAt.toISOString(),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function acceptFriendRequest(
  prisma: PrismaClient,
  userId: string,
  friendId: string,
): Promise<Friendship | null> {
  if (!userId || !friendId || userId === friendId) return null;

  // Atomically transition from PENDING to ACCEPTED to prevent concurrent double-accepts
  const updated = await prisma.friendship.updateMany({
    where: {
      userId: friendId,
      friendId: userId,
      status: FriendshipStatus.PENDING,
    },
    data: { status: FriendshipStatus.ACCEPTED },
  });

  if (updated.count === 0) return null;

  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: friendId, friendId: userId } },
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

export async function deleteFriendRequest(
  prisma: PrismaClient,
  userId: string,
  friendId: string,
): Promise<boolean> {
  if (!userId || !friendId) return false;

  // Single atomic DELETE statement avoids SELECT-then-DELETE P2025 race conditions
  const deleted = await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });

  return deleted.count > 0;
}

////// Helper functions

async function getSent(
  prisma: PrismaClient,
  userId: string,
  status: FriendshipStatus,
): Promise<Profile[]> {
  const results = await prisma.friendship.findMany({
    where: { userId, status },
    include: {
      friend: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          createdAt: true,
          elo: true,
        },
      },
    },
  });
  return results.map((f: FriendshipWithFriend) => mapToProfile(f.friend));
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
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          createdAt: true,
          elo: true,
        },
      },
    },
  });
  return results.map((f: FriendshipWithUser) => mapToProfile(f.user));
}

function mapToProfile(user: {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: Date;
  elo: number;
}): Profile {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    elo: user.elo,
  };
}
