import { FastifyInstance } from "fastify";
import * as friendsService from "../services/friends.service.js";
import type { FriendSocketEvent, JwtPayload, Profile } from "shared";

const CHAT_URL =
  process.env.CHAT_INTERNAL_URL || "http://chat:3003/internal/events";

const uuidParamSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
};

async function notifyChatUser(
  fastify: FastifyInstance,
  targetUserId: string,
  event: FriendSocketEvent,
): Promise<void> {
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, event }),
    });
    if (!res.ok) {
      fastify.log.warn(
        { status: res.status, targetUserId, eventType: event.type },
        "Chat service rejected internal friend event",
      );
    }
  } catch (err) {
    fastify.log.warn(
      { err, targetUserId, eventType: event.type },
      "Failed to relay friend event to chat service",
    );
  }
}

async function getUserProfile(
  fastify: FastifyInstance,
  userId: string,
): Promise<Profile | null> {
  const user = await fastify.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      createdAt: true,
      elo: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    elo: user.elo,
  };
}

export default async function friendsRoutes(fastify: FastifyInstance) {
  fastify.get("/friends", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    const friends = await friendsService.getFriends(fastify.prisma, id);
    return reply.send({ friends });
  });

  fastify.get("/friends/requests/received", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    const receivedRequests = await friendsService.getReceivedPendingRequests(
      fastify.prisma,
      id,
    );
    return reply.send({ receivedRequests });
  });

  fastify.get("/friends/requests/sent", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    const sentRequests = await friendsService.getSentPendingRequests(
      fastify.prisma,
      id,
    );
    return reply.send({ sentRequests });
  });

  fastify.post(
    "/friends/request/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      await request.jwtVerify();
      const { id: userId } = request.user as JwtPayload;
      const { id: friendId } = request.params as { id: string };

      try {
        const friendship = await friendsService.sendFriendRequest(
          fastify.prisma,
          userId,
          friendId,
        );
        if (!friendship)
          return reply
            .code(400)
            .send({ error: "Could not send friend request" });

        const senderProfile = await getUserProfile(fastify, userId);
        if (senderProfile) {
          await notifyChatUser(fastify, friendId, {
            type: "friend_request_received",
            sender: senderProfile,
          });
        }
        return reply.send({ friendship });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2002" || prismaError.code === "P2034") {
          return reply
            .code(409)
            .send({ error: "Friend request already exists or conflict" });
        }
        if (prismaError.code === "P2003") {
          return reply.code(404).send({ error: "Target user not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.post(
    "/friends/accept/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      await request.jwtVerify();
      const { id: userId } = request.user as JwtPayload;
      const { id: friendId } = request.params as { id: string };

      try {
        const friendship = await friendsService.acceptFriendRequest(
          fastify.prisma,
          userId,
          friendId,
        );
        if (!friendship)
          return reply.code(404).send({ error: "Friend request not found" });

        const accepterProfile = await getUserProfile(fastify, userId);
        if (accepterProfile) {
          await notifyChatUser(fastify, friendId, {
            type: "friend_request_accepted",
            friend: accepterProfile,
          });
        }
        return reply.send({ friendship });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2025") {
          return reply.code(404).send({ error: "Friend request not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.delete(
    "/friends/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      await request.jwtVerify();
      const { id: userId } = request.user as JwtPayload;
      const { id: friendId } = request.params as { id: string };

      try {
        const deleted = await friendsService.deleteFriendRequest(
          fastify.prisma,
          userId,
          friendId,
        );
        if (!deleted)
          return reply.code(404).send({ error: "Friendship not found" });

        await notifyChatUser(fastify, friendId, {
          type: "friend_removed",
          userId,
        });
        return reply.send({ message: "Friendship deleted" });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2025") {
          return reply.code(404).send({ error: "Friendship not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  ////// Blocking

  fastify.get("/blocks", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    const blocked = await friendsService.getBlockedUsers(fastify.prisma, id);
    return reply.send({ blocked });
  });

  fastify.post(
    "/blocks/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      await request.jwtVerify();
      const { id: userId } = request.user as JwtPayload;
      const { id: targetId } = request.params as { id: string };

      try {
        const done = await friendsService.blockUser(
          fastify.prisma,
          userId,
          targetId,
        );
        if (!done)
          return reply.code(400).send({ error: "You cannot block yourself" });

        // The blocked user loses me from their friends list (and from their
        // pending requests) right away. They are not told why.
        await notifyChatUser(fastify, targetId, {
          type: "friend_removed",
          userId,
        });
        // My other tabs too: they still listed the blocked user as a friend
        // until a reload (the tab that blocked has already forgotten them)
        await notifyChatUser(fastify, userId, {
          type: "friend_removed",
          userId: targetId,
        });
        return reply.send({ message: "User blocked" });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2003") {
          return reply.code(404).send({ error: "Target user not found" });
        }
        if (prismaError.code === "P2002" || prismaError.code === "P2034") {
          // Two blocks at the same time: the other one won, same result
          return reply.send({ message: "User blocked" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.delete(
    "/blocks/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      await request.jwtVerify();
      const { id: userId } = request.user as JwtPayload;
      const { id: targetId } = request.params as { id: string };

      const done = await friendsService.unblockUser(
        fastify.prisma,
        userId,
        targetId,
      );
      if (!done) return reply.code(404).send({ error: "User is not blocked" });
      return reply.send({ message: "User unblocked" });
    },
  );
}
