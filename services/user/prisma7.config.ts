import "dotenv/config";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Fonction pour récupérer la DB_URL depuis le secret Docker ou l'environnement
function getDatabaseUrl(): string | undefined {
  const secretPath = "/run/secrets/db_url";
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf-8").trim();
  }
  return process.env["DATABASE_URL"];
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
