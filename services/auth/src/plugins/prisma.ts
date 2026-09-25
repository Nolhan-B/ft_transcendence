import fp from 'fastify-plugin';
import fs from 'node:fs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Fonction pour récupérer l'URL de connexion sécurisée
function getDatabaseUrl(): string {
  const secretPath = '/run/secrets/db_password';

  if (fs.existsSync(secretPath)) {
    const password = fs.readFileSync(secretPath, 'utf8').trim();
    const user = process.env.DB_USER ?? 'transcendence_user';
    const host = process.env.DB_HOST ?? 'postgres';
    const port = process.env.DB_PORT ?? '5432';
    const dbName = process.env.DB_NAME ?? 'transcendence_db';

    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  }

  // Fallback si jamais on lance hors conteneur
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error("Impossible de se connecter : aucun secret ni variable DATABASE_URL trouvée.");
}

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default fp(async (fastify) => {
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    await pool.end();
  });
});