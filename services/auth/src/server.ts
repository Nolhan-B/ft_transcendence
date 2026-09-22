import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma.js';
import authRoutes from './routes/auth.js';

const app = Fastify({ logger: true });

app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret' });
app.register(prismaPlugin);
app.register(authRoutes);

const port = Number(process.env.AUTH_PORT ?? 3001);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});