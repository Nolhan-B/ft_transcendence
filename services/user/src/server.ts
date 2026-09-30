import 'dotenv/config';
import Fastify from 'fastify';
import prismaPlugin from './plugins/prisma.js';
import jwt from '@fastify/jwt';
import profileRoutes from './routes/profiles.js';

const app = Fastify({ logger: true });

app.register(prismaPlugin);
app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret' });
app.register(profileRoutes);

app.get('/health', async () => ({ service: 'user', status: 'ok' }));

const port = Number(process.env.USER_PORT ?? 3004);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
