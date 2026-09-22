import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import * as authService from '../services/auth.service.js'

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/signup', async (request, reply) => {
    const { email, username, password } = request.body as {
      email: string;
      username: string;
      password: string;
    };

    const user = await authService.signup(fastify.prisma, email, username, password);
    const token = fastify.jwt.sign({ id: user.id, email: user.email });
    return reply.code(201).send({ token, user });


  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return { token, user: { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt } };
  });

  fastify.get('/health', async () => ({ service: 'auth', status: 'ok' }));
}
