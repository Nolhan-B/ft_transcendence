import 'dotenv/config';
import Fastify from 'fastify';
import prismaPlugin from './plugins/prisma.js';

const app = Fastify({ logger: true });

app.register(prismaPlugin);

app.get('/health', async () => ({ service: 'user', status: 'ok' }));

const port = Number(process.env.USER_PORT ?? 3004);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});