#!/usr/bin/env bash
# Copies a database snapshot into deploy/seed/ so the Docker image can seed an empty volume on first boot.
# Usage: deploy/prepare-seed.sh [snapshot-name]   (default: pristine; falls back to prisma/beacon.db)
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:-pristine}"
source="data/snapshots/${name}/beacon.db"
if [ ! -f "$source" ]; then
  if [ -f prisma/beacon.db ]; then
    echo "No snapshot named '${name}'; using the live database prisma/beacon.db instead." >&2
    source="prisma/beacon.db"
  else
    echo "No snapshot named '${name}' and no prisma/beacon.db. Run: npm run demo:snapshot -- ${name}" >&2
    exit 1
  fi
fi

mkdir -p deploy/seed
cp "$source" deploy/seed/beacon.db
echo "Seed ready: deploy/seed/beacon.db (from ${source}). It is ignored by git and shipped only inside the image."
