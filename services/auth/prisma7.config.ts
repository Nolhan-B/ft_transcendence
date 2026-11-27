import fs from "node:fs";
import process from "node:process";
import { defineConfig } from "prisma/config";

function getDatabaseUrl(): string {
  // 1. Variable d'environnement explicite (prioritaire)
  if (process.env["DATABASE_URL"]) {
    return process.env["DATABASE_URL"];
  }
  // 2. Secret db_url
  if (fs.existsSync("/run/secrets/db_url")) {
    const url = fs.readFileSync("/run/secrets/db_url", "utf-8").trim();
    console.log(
      `[prisma-config] using db_url secret -> ${url.replace(/:[^:@]+@/, ":***@")}`,
    );
    return url;
  }
  // 3. Reconstruction depuis le mot de passe
  if (fs.existsSync("/run/secrets/db_password")) {
    const password = encodeURIComponent(
      fs.readFileSync("/run/secrets/db_password", "utf-8").trim(),
    );
    return `postgresql://transcendence_user:${password}@postgres:5432/transcendence_db?schema=public`;
  }
  if (process.env["DATABASE_URL"]) {
    return process.env["DATABASE_URL"];
  }
  return "postgresql://build:build@postgres:5432/build?schema=public";
}

export default defineConfig({
  schema: "/app/shared/prisma/schema.prisma",
  datasource: {
    url: getDatabaseUrl(),
  },
});
