import { FastifyInstance } from 'fastify';
import * as profileService from '../services/profile.service.js';
import type { JwtPayload, UpdateProfilePayload } from 'shared';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';

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

    const updatedProfile = await profileService.updateProfile(
      fastify.prisma,
      id,
      data,
    );
    if (!updatedProfile)
      return reply.code(404).send({ error: 'User not found' });

    return reply.send({ updatedProfile });
  });

  fastify.put('/profile/avatar', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });

    const ext = path.extname(file.filename);
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!allowed.includes(ext.toLowerCase())) {
      return reply.code(400).send({ error: 'Invalid file type' });
    }

    const filename = `${id}-${Date.now()}${ext}`;
    const filepath = path.join(process.cwd(), 'uploads', 'avatars', filename);

    await pipeline(file.file, fs.createWriteStream(filepath));

    const profile = await profileService.updateAvatar(
      fastify.prisma,
      id,
      `/uploads/avatars/${filename}`,
    );
    if (!profile) return reply.code(404).send({ error: 'User not found' });

    return reply.send({ profile });
  });
}
