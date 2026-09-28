import { FastifyInstance } from 'fastify';
import * as twofaService from '../services/twoaf.service.js';
import { verify } from 'otplib';

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

  fastify.post('/2fa/validate', async (request, reply) => {
    const { tempToken, code } = request.body as {
      tempToken: string;
      code: string;
    };
    const payload = fastify.jwt.verify(tempToken) as {
      id: string;
      requires2FA: boolean;
    };
    if (!payload.requires2FA)
      return reply.code(401).send({ error: 'Invalid token' });

    const user = await twofaService.validateTwoFactor(
      fastify.prisma,
      payload.id,
      code,
    );
    if (!user) return reply.code(401).send({ error: 'Invalid code' });

    const token = fastify.jwt.sign({ id: user.id, email: user.email });
    return reply.send({ token, user });
  });

  fastify.post('/2fa/disable', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as { id: string };
    const { password, code } = request.body as {
      password: string;
      code: string;
    };

    const user = await twofaService.disableTwoFactor(
      fastify.prisma,
      id,
      password,
      code,
    );
    if (!user)
      return reply.code(401).send({ error: 'Invalid password or TOTP code' });

    return reply.send({ message: '2FA disabled', user });
  });
}
