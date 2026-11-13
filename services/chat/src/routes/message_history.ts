import { FastifyInstance } from "fastify";
import type { JwtPayload } from "shared";

export default async function messageHistoryRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { otherUserId: string };
    Querystring: { before?: string };
  }>(
    "/conversations/:otherUserId/messages",
    {
      schema: {
        params: {
          type: "object",
          required: ["otherUserId"],
          properties: {
            otherUserId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            // Enforce ISO 8601 date-time format so new Date(before) never produces Invalid Date
            before: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { id: currentUserId } = request.user as JwtPayload;
      const { otherUserId } = request.params;
      const { before } = request.query;

      // Extra guard against edge-case unparseable dates before passing to Prisma
      let beforeDate: Date | undefined;
      if (before) {
        beforeDate = new Date(before);
        if (Number.isNaN(beforeDate.getTime())) {
          return reply.code(400).send({ error: "Invalid 'before' timestamp" });
        }
      }

      try {
        // Check if either user has blocked the other
        const isBlocked = await fastify.prisma.blockedFriendship.findFirst({
          where: {
            OR: [
              { blockerId: currentUserId, blockedId: otherUserId },
              { blockerId: otherUserId, blockedId: currentUserId },
            ],
          },
        });

        if (isBlocked) {
          return reply
            .code(403)
            .send({ error: "Access denied: user is blocked" });
        }

        const messages = await fastify.prisma.directMessage.findMany({
          where: {
            OR: [
              { senderId: currentUserId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: currentUserId },
            ],
            ...(beforeDate && {
              createdAt: {
                lt: beforeDate,
              },
            }),
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            messageType: true,
            gameRoomId: true,
            createdAt: true,
            delivered: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        });

        return reply.code(200).send({
          messages: messages.reverse(),
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
