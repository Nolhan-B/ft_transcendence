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

  fastify.get('/friends/requests/sent', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const receivedRequests = await friendsService.getSentPendingRequests(
      fastify.prisma,
      id,
    );

    return reply.send({ receivedRequests });
  });

  fastify.post('/friends/request/:id', async (request, reply) => {
    await request.jwtVerify();
    const { id: userId } = request.user as JwtPayload;
    const { id: friendId } = request.params as { id: string };

    const receivedRequests = await friendsService.sendFriendRequest(
      fastify.prisma,
      userId,
      friendId
    );

    return reply.send({ receivedRequests });
  });
}
