import { FastifyInstance } from 'fastify';
import * as authService from '../services/auth.service.js';
import type {
  SignupPayload,
  LoginPayload,
  TwoFactorRequiredResponse,
} from '@shared/types/user.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'username', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            username: { type: 'string', minLength: 3, maxLength: 20 },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, username, password } = request.body as SignupPayload;

      try {
        const user = await authService.signup(
          fastify.prisma,
          email,
          username,
          password,
        );
        const token = fastify.jwt.sign({ id: user.id, email: user.email });
        return reply.code(201).send({ token, user });
      } catch (err) {
        request.log.error(err);
        return reply
          .code(409)
          .send({ error: 'Email or username already taken' });
      }
    },
  );

  fastify.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as LoginPayload;

      const user = await authService.login(fastify.prisma, email, password);
      if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

      if (user.twoFactorSecretEnabled) {
        const tempToken = fastify.jwt.sign(
          { id: user.id, requires2FA: true },
          { expiresIn: '5m' },
        );
        return reply.send({
          requiresTwoFactor: true,
          tempToken,
        } as TwoFactorRequiredResponse);
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email });
      return { token, user };
    },
  );

  fastify.get('/health', async () => ({ service: 'auth', status: 'ok' }));

  fastify.get('/me', async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as { id: string; email: string };

    const user = await authService.getMe(fastify.prisma, id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { user };
  });
}
