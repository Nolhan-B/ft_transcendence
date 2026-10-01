#!/bin/sh
set -e

echo "[auth] Container starting..."

echo "[auth] Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  sleep 0.5
done
echo "[auth] PostgreSQL is ready!"

# Synchronisation avec le chemin relatif
echo "[auth] Pushing Prisma schema to PostgreSQL..."
npx prisma db push --config=./prisma7.config.ts --schema=/app/shared/prisma/schema.prisma --accept-data-loss

echo "[auth] Starting application server..."
exec "$@"