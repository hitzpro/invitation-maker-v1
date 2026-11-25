#!/usr/bin/env bash
set -euo pipefail

# Muat .env bila ada
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL belum diatur}"
UPLOAD_PATH="${UPLOAD_DIR:-./uploads}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="./backups/${STAMP}"

mkdir -p "$DEST"

echo "Membackup database..."
pg_dump "$DATABASE_URL" --format=custom --file="${DEST}/database.dump"

if [ -d "$UPLOAD_PATH" ]; then
  echo "Membackup folder upload..."
  tar -czf "${DEST}/uploads.tar.gz" -C "$(dirname "$UPLOAD_PATH")" "$(basename "$UPLOAD_PATH")"
fi

# Hapus backup yang lebih tua dari 14 hari
find ./backups -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +

echo "Backup selesai di ${DEST}"