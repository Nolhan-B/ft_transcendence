import { FastifyInstance } from 'fastify';
import * as friendsService from '../services/friends.service.js';
import type { JwtPayload } from 'shared';

export default async function friendsRoutes(fastify: FastifyInstance) {
  fastify.get('/friends', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const friends = await friendsService.getFriends(fastify.prisma, id);

    return reply.send({ friends });
  });

  fastify.get('/friends/requests/received', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const receivedRequests = await friendsService.getReceivedPendingRequests(
      fastify.prisma,
      id,
    );

    return reply.send({ receivedRequests });
  });
}
