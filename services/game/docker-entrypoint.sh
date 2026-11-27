#!/bin/sh
set -e

echo "[game] Container starting..."

if [ -f /run/secrets/db_url ]; then
  export DATABASE_URL=$(cat /run/secrets/db_url)
elif [ -f /run/secrets/db_password ]; then
  DB_PASSWORD=$(cat /run/secrets/db_password)
  export DATABASE_URL="postgresql://transcendence_user:${DB_PASSWORD}@postgres:5432/transcendence_db"
else
  echo "[game] ERROR: no database credentials found!"
  exit 1
fi

echo "[game] Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  sleep 0.5
done
echo "[game] PostgreSQL is ready!"

echo "[game] Starting application server..."
exec "$@"
