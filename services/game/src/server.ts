import Fastify from 'fastify';

const fastify = Fastify({
  logger: true
});

fastify.get('/', async () => {
  return { service: 'game', status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();