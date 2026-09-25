#!/bin/sh
set -e

echo "[auth] Container starting..."

# 1. Read database password from Docker secret
if [ -f /run/secrets/db_password ]; then
  DB_PASSWORD=$(cat /run/secrets/db_password)
  export DATABASE_URL="postgresql://transcendence_user:${DB_PASSWORD}@postgres:5432/transcendence_db"
else
  echo "[auth] ERROR: db_password secret not found!"
  exit 1
fi

# 2. Wait for PostgreSQL port to be ready
echo "[auth] Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  sleep 0.5
done
echo "[auth] PostgreSQL is ready!"

# 3. Synchronize database schema automatically
echo "[auth] Pushing Prisma schema to PostgreSQL..."
npx prisma db push

# 4. Start the main service
echo "[auth] Starting application server..."
exec "$@"