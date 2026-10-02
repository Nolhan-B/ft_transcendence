import 'dotenv/config';
import fs from 'node:fs';
import { defineConfig } from 'prisma/config';

function getDatabaseUrl(): string | undefined {
  if (fs.existsSync('/run/secrets/db_password')) {
    const password = encodeURIComponent(
      fs.readFileSync('/run/secrets/db_password', 'utf-8').trim(),
    );
    return `postgresql://transcendence_user:${password}@postgres:5432/transcendence_db?schema=public`;
  }
  if (fs.existsSync('/run/secrets/db_url')) {
    return fs.readFileSync('/run/secrets/db_url', 'utf-8').trim();
  }
  return process.env['DATABASE_URL'];
}

export default defineConfig({
  schema: '/app/shared/prisma/schema.prisma',
  datasource: {
    url: getDatabaseUrl(),
  },
});
