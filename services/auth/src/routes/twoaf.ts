import { FastifyInstance } from 'fastify';
import * as twofaService from '../services/twoaf.service.js';
import { authenticator } from '@otplib/preset-default';

export default async function twofaRoutes(fastify: FastifyInstance) {
  fastify.post('/2fa/enable', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as { id: string };

    const qrCode = await twofaService.enableTwoFactor(fastify.prisma, id);
    return reply.send({ qrCode });
  });

  fastify.post('/2fa/verify', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as { id: string };
    const { code } = request.body as { code: string };

    const user = await twofaService.verifyTwoFactor(fastify.prisma, id, code);
    if (!user) return reply.code(401).send({ error: 'Invalid code' });

    return reply.send({ message: '2FA enabled', user });
  });
}
