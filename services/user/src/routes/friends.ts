import { FastifyInstance } from "fastify";
import * as friendsService from "../services/friends.service.js";
import type { JwtPayload } from "shared";

// Reusable JSON schema to validate UUID route parameters before hitting Prisma
const uuidParamSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
};

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

        return reply.send({ friendship });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        // Handle concurrent duplicate friend request (P2002) or serializable conflict (P2034)
        if (prismaError.code === "P2002" || prismaError.code === "P2034") {
          return reply
            .code(409)
            .send({ error: "Friend request already exists or conflict" });
        }
        // Handle foreign key violation when target user does not exist
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

        return reply.send({ friendship });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        // Handle concurrent accept/cancel race condition
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

        return reply.send({ message: "Friendship deleted" });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        // Handle concurrent delete race condition
        if (prismaError.code === "P2025") {
          return reply.code(404).send({ error: "Friendship not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
