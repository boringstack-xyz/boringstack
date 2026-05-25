#!/usr/bin/env bash
# Postgres → rclone remote backup wrapper.
#
# Copy to `backup-wrapper.sh`, chmod +x, customize paths + remote, schedule via
# cron. Designed to be safe to run from cron: idempotent, logs to stdout/stderr
# for cron mail capture, exits non-zero on any failure.
#
# What it does:
#   1. pg_dump the Postgres container, gzip it locally
#   2. rclone copy to ${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}
#   3. Delete remote backups older than ${BACKUP_RETENTION_DAYS} (default 30)
#   4. Remove the local temp dump
#
# Env (sourced from compose/.env if present):
#   POSTGRES_USER, POSTGRES_DB              — required
#   RCLONE_REMOTE_NAME, RCLONE_REMOTE_PATH  — required
#   BACKUP_RETENTION_DAYS                   — optional, default 30
#   BACKUP_DRY_RUN=1                        — log the steps but don't run them

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/path/to/infra/compose/compose}"
cd "$COMPOSE_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${RCLONE_REMOTE_NAME:?RCLONE_REMOTE_NAME is required (e.g. postgres_backup)}"
: "${RCLONE_REMOTE_PATH:?RCLONE_REMOTE_PATH is required (e.g. /db-backups)}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DRY_RUN="${BACKUP_DRY_RUN:-0}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="${TMPDIR:-/tmp}"
DUMP="$WORKDIR/db_backup_${TS}.sql.gz"

log()  { echo "[$(date -u +%FT%TZ)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] $*"
  else
    "$@"
  fi
}

trap '[[ -f "$DUMP" ]] && rm -f "$DUMP"' EXIT

log "Starting backup: db=$POSTGRES_DB remote=${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH} retention=${RETENTION_DAYS}d"

log "Step 1/3: pg_dump → ${DUMP}"
if [[ "$DRY_RUN" == "1" ]]; then
  log "[dry-run] docker compose exec -T postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | gzip > $DUMP"
else
  if ! docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$DUMP"; then
    fail "pg_dump failed"
  fi
  [[ -s "$DUMP" ]] || fail "dump file is empty: $DUMP"
  log "  produced $(du -h "$DUMP" | awk '{print $1}')"
fi

log "Step 2/3: rclone copy → ${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}"
if ! run rclone copy "$DUMP" "${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}" --checksum; then
  fail "rclone copy failed"
fi

log "Step 3/3: prune remote backups older than ${RETENTION_DAYS}d"
if ! run rclone delete "${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}" \
       --min-age "${RETENTION_DAYS}d" \
       --include "db_backup_*.sql.gz"; then
  fail "rclone delete (retention) failed"
fi

log "Done."
