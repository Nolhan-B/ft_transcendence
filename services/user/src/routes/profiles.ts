import { FastifyInstance } from 'fastify';
import * as profileService from '../services/profile.service.js';
import type { JwtPayload, UpdateProfilePayload } from 'shared';

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const profile = await profileService.getProfileById(fastify.prisma, id);
    if (!profile) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ profile });
  });

  fastify.get('/profile', async (request, reply) => {
    await request.jwtVerify();

    const { id } = request.user as JwtPayload;

    const profile = await profileService.getProfileById(fastify.prisma, id);
    if (!profile) return reply.code(404).send({ error: 'User not found' });

    return reply.send({ profile });
  });

  fastify.put('/profile', async (request, reply) => {
    await request.jwtVerify();

    const data = request.body as UpdateProfilePayload;
    const { id } = request.user as JwtPayload;

    const updatedProfile = await profileService.updateProfile(fastify.prisma, id, data);
    if (!updatedProfile) return reply.code(404).send({ error: 'User not found' });

    return reply.send({ updatedProfile });
  });
}
