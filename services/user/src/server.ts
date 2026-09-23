import Fastify from 'fastify';

const fastify = Fastify({
  logger: true
});

fastify.get('/', async () => {
  return { service: 'user', status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3004, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();