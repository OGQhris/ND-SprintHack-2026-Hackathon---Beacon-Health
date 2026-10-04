#!/usr/bin/env bash
# Container start: make sure the persistent data directory exists, seed the database on the very first
# boot, apply any pending Prisma migrations, then serve the production build on all interfaces.
set -euo pipefail

DATA_DIR="${DATA_DIR:-/app/data}"
export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/beacon.db}"
DB_PATH="${DATABASE_URL#file:}"

mkdir -p "$DATA_DIR" "$DATA_DIR/verification-runs" /app/debug

if [ ! -s "$DB_PATH" ]; then
  if [ -s /app/seed/beacon.db ]; then
    cp /app/seed/beacon.db "$DB_PATH"
    echo "[Entrypoint] Seeded $DB_PATH from the snapshot baked into the image."
  else
    : > "$DB_PATH"
    echo "[Entrypoint] No seed database in the image; starting empty. Import the roster with: npm run import -- <workbook.xlsx>"
  fi
fi

echo "[Entrypoint] Applying migrations to $DATABASE_URL"
./node_modules/.bin/prisma migrate deploy

echo "[Entrypoint] Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec ./node_modules/.bin/next start --hostname "${HOSTNAME:-0.0.0.0}" --port "${PORT:-3000}"
