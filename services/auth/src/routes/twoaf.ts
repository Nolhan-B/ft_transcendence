import { FastifyInstance } from 'fastify';
import * as twofaService from '../services/twoaf.service.js';

export default async function twofaRoutes(fastify: FastifyInstance) {
  fastify.post('/2fa/enable', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as { id: string };

    const qrCode = await twofaService.enableTwoFactor(fastify.prisma, id);
    return reply.send({ qrCode });
  });
}
