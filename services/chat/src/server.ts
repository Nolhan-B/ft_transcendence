import Fastify from 'fastify';
import fs from 'node:fs';
import process from 'node:process';

if (fs.existsSync('/run/secrets/db_url')) {
  process.env.DATABASE_URL = fs.readFileSync('/run/secrets/db_url', 'utf-8').trim();
}

const fastify = Fastify({
  logger: true
});

fastify.get('/', async () => {
  return { service: 'chat', status: 'ok' };
});

fastify.get('/health', {
  logLevel: 'silent'
}, async () => ({ service: 'chat', status: 'ok' }));

const start = async () => {
  try {
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();