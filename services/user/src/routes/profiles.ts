import { FastifyInstance } from 'fastify';
import * as profileService from '../services/profile.service.js';

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await profileService.getProfile(fastify.prisma, id);
  });
}
