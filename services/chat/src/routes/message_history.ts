import { FastifyInstance } from "fastify";
import type { JwtPayload } from "shared";

export default async function messageHistoryRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { otherUserId: string };
    Querystring: { before?: string };
  }>("/conversations/:otherUserId/messages", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id: currentUserId } = request.user as JwtPayload;
    const { otherUserId } = request.params;
    const { before } = request.query;

    try {
      // check if one of the user is blocked
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
          ...(before && {
            createdAt: {
              lt: new Date(before),
            },
          }),
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
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
  });
}
