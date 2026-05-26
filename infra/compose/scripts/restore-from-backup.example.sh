#!/usr/bin/env bash
# Restore a Postgres backup produced by backup-wrapper.example.sh.
#
# Copy to `restore-from-backup.sh`, chmod +x, customize $COMPOSE_DIR.
# This script is the partner to backup-wrapper.example.sh — a backup
# that has never been restored is a guess, not a backup. Run a dry
# restore at least monthly against a scratch database to prove the
# pipeline still works.
#
# What it does:
#   1. Lists remote backups by timestamp (no args).
#   2. Pulls the requested backup into $WORKDIR.
#   3. Restores into ${RESTORE_DB:-${POSTGRES_DB}_restore_$TS} so the
#      live database is never touched without the operator opting in.
#   4. Reports row counts on `auth.users` + `app.accounts` so a smoke
#      check is one line.
#
# Promoting the restored DB to live is a separate manual step (rename
# the databases, restart api containers) — kept manual on purpose so
# the operator confirms the intent before the swap.
#
# Env (sourced from compose/.env if present):
#   POSTGRES_USER, POSTGRES_DB             — required
#   RCLONE_REMOTE_NAME, RCLONE_REMOTE_PATH — required
#   RESTORE_DB                             — optional override of the target DB
#   RESTORE_DRY_RUN=1                      — print the steps without executing
#
# Usage:
#   restore-from-backup.sh                       # list available backups
#   restore-from-backup.sh latest                # restore the most recent
#   restore-from-backup.sh db_backup_20260520T030000Z.sql.gz

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
: "${RCLONE_REMOTE_NAME:?RCLONE_REMOTE_NAME is required}"
: "${RCLONE_REMOTE_PATH:?RCLONE_REMOTE_PATH is required}"

DRY_RUN="${RESTORE_DRY_RUN:-0}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_DB="${RESTORE_DB:-${POSTGRES_DB}_restore_${TS}}"
WORKDIR="${TMPDIR:-/tmp}"

log()  { echo "[$(date -u +%FT%TZ)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] $*"
  else
    "$@"
  fi
}

list_backups() {
  rclone lsf "${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}" \
    --include "db_backup_*.sql.gz" \
    | sort
}

resolve_target() {
  local arg="${1:-}"

  if [[ -z "$arg" ]]; then
    log "Available backups on ${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}:"
    list_backups | sed 's/^/  /'
    echo ""
    echo "Pass 'latest' or a specific filename to restore."
    exit 0
  fi

  if [[ "$arg" == "latest" ]]; then
    list_backups | tail -1
    return
  fi

  echo "$arg"
}

TARGET="$(resolve_target "${1:-}")"
[[ -n "$TARGET" ]] || fail "Could not resolve backup target. Run with no args to list."

LOCAL_DUMP="$WORKDIR/${TARGET}"

trap '[[ -f "$LOCAL_DUMP" ]] && rm -f "$LOCAL_DUMP"' EXIT

log "Restoring: $TARGET → database '$RESTORE_DB'"
log "  source: ${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}/$TARGET"
log "  target: container 'postgres', user '$POSTGRES_USER'"

log "Step 1/4: rclone copy → $LOCAL_DUMP"
if ! run rclone copy "${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}/$TARGET" "$WORKDIR" --checksum; then
  fail "rclone copy failed"
fi

if [[ "$DRY_RUN" != "1" ]]; then
  [[ -s "$LOCAL_DUMP" ]] || fail "downloaded file is empty: $LOCAL_DUMP"
  log "  pulled $(du -h "$LOCAL_DUMP" | awk '{print $1}')"
fi

log "Step 2/4: create database '$RESTORE_DB' (idempotent)"
# 'CREATE DATABASE' can't run inside a transaction; pipe a single
# psql -c so the existence check + create stay together.
if ! run bash -c "docker compose exec -T postgres psql -U '$POSTGRES_USER' -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$RESTORE_DB'\" | grep -q 1 || docker compose exec -T postgres psql -U '$POSTGRES_USER' -d postgres -c \"CREATE DATABASE \\\"$RESTORE_DB\\\"\""; then
  fail "create database failed"
fi

log "Step 3/4: restore → '$RESTORE_DB'"
if [[ "$DRY_RUN" == "1" ]]; then
  log "[dry-run] gunzip -c $LOCAL_DUMP | docker compose exec -T postgres psql -U $POSTGRES_USER -d $RESTORE_DB -q"
else
  if ! gunzip -c "$LOCAL_DUMP" | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -q -v ON_ERROR_STOP=1 >/dev/null; then
    fail "psql restore failed"
  fi
fi

log "Step 4/4: smoke check"
if [[ "$DRY_RUN" == "1" ]]; then
  log "[dry-run] SELECT COUNT(*) FROM auth.users, app.accounts"
else
  USERS_COUNT="$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc 'SELECT COUNT(*) FROM auth.users' 2>/dev/null || echo 'n/a')"
  ACCOUNTS_COUNT="$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc 'SELECT COUNT(*) FROM app.accounts' 2>/dev/null || echo 'n/a')"
  log "  auth.users: ${USERS_COUNT}"
  log "  app.accounts: ${ACCOUNTS_COUNT}"
fi

log "Done. Database '$RESTORE_DB' is restored."
log "To promote (manual, intentional):"
log "  docker compose exec postgres psql -U $POSTGRES_USER -d postgres -c \\"
log "    \"ALTER DATABASE \\\"$POSTGRES_DB\\\" RENAME TO ${POSTGRES_DB}_pre_restore_${TS};\""
log "  docker compose exec postgres psql -U $POSTGRES_USER -d postgres -c \\"
log "    \"ALTER DATABASE \\\"$RESTORE_DB\\\" RENAME TO \\\"$POSTGRES_DB\\\";\""
log "  docker compose restart api"
