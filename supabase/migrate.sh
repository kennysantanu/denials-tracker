#!/bin/sh
# Idempotent migration runner for Denials Tracker.
#
# Reads every *.sql file in /migrations (sorted by filename) and applies
# any that haven't been recorded in the _app_migrations tracking table.
# Safe to re-run: already-applied files are skipped.
#
# Required env: DATABASE_URL (e.g. postgres://postgres:pwd@db:5432/postgres)
#
# Designed to run as a one-shot service in docker-compose.

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "[migrate] Waiting for database to accept connections..."
ATTEMPTS=0
until psql "$DATABASE_URL" -c '\q' >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt 60 ]; then
    echo "[migrate] ERROR: database not reachable after 60 attempts" >&2
    exit 1
  fi
  sleep 2
done
echo "[migrate] Database reachable."

# Tracking table — records which migration files have been applied.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS public._app_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);
SQL

APPLIED_COUNT=0
SKIPPED_COUNT=0

# POSIX-safe iteration over sorted *.sql files.
for sql_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  fname=$(basename "$sql_file")

  already_applied=$(psql "$DATABASE_URL" -tAc \
    "SELECT 1 FROM public._app_migrations WHERE filename = '$fname' LIMIT 1;" \
    2>/dev/null || true)

  if [ "$already_applied" = "1" ]; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo "[migrate] Applying $fname ..."
  checksum=$(md5sum "$sql_file" | awk '{print $1}')

  # Each migration runs in its own transaction. ON_ERROR_STOP aborts on first
  # error so we never record a half-applied migration.
  if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$sql_file"; then
    echo "[migrate] ERROR: $fname failed" >&2
    exit 1
  fi

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO public._app_migrations (filename, checksum) VALUES ('$fname', '$checksum');" \
    >/dev/null

  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done

echo "[migrate] Done. Applied: $APPLIED_COUNT, skipped (already applied): $SKIPPED_COUNT."
