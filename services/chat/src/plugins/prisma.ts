import fp from "fastify-plugin";
import fs from "node:fs";
import process from "node:process";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "shared";

// Build database connection string from Docker secret or environment fallback
function getDatabaseUrl(): string {
  const secretPath = "/run/secrets/db_password";

  if (fs.existsSync(secretPath)) {
    const password = fs.readFileSync(secretPath, "utf8").trim();
    const user = process.env.DB_USER ?? "transcendence_user";
    const host = process.env.DB_HOST ?? "postgres";
    const port = process.env.DB_PORT ?? "5432";
    const dbName = process.env.DB_NAME ?? "transcendence_db";

    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  }

  // Fallback when running outside Docker with DATABASE_URL set
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error(
    "Database connection failed: neither /run/secrets/db_password nor DATABASE_URL is defined.",
  );
}

const pool = new pg.Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Prevent unhandled 'error' events on idle pool clients from crashing the Node.js process
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error on idle client:", err);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default fp(async (fastify) => {
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
    await pool.end();
  });
});
