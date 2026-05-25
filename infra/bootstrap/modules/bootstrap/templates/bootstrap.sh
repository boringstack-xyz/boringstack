#!/usr/bin/env bash
#
# BoringStack first-boot bootstrap.
#
# Runs from cloud-init's runcmd after Docker is installed. Clones only the
# infra repo (which holds the docker-compose YAML), drops the rendered
# compose/.env, and pulls the api + ui images from GHCR.
#
# No api/ui source clones — those repos are deployment artifacts, not source.
# No on-box builds — images come from the release.yml workflows in each repo.
#
# Idempotent: re-running re-pulls the infra repo, pulls fresh images, and
# brings the stack back up.
# Safe to run by hand for debugging:
#   bash -x /opt/boringstack/bootstrap.sh

set -euo pipefail

LOG_PREFIX="[boringstack-bootstrap]"
ROOT=/opt/boringstack
ENV_FILE_SRC="$ROOT/compose.env"
CONFIG_FILE=/etc/boringstack/config.json

log() { echo "$LOG_PREFIX $*"; }

config_value() {
  local key="$1"
  jq -r --arg key "$key" 'if has($key) and .[$key] != null then .[$key] else "" end' "$CONFIG_FILE"
}

require_value() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    log "Missing required config value: $name"
    exit 1
  fi
}

if [[ ! -r "$CONFIG_FILE" ]]; then
  log "Missing bootstrap config: $CONFIG_FILE"
  exit 1
fi

jq -e . "$CONFIG_FILE" >/dev/null

INFRA_REPO=$(config_value infra_repo)
BACKUPS_ENABLED=$(config_value backups_enabled)
RCLONE_REMOTE_NAME=$(config_value rclone_remote_name)
RCLONE_REMOTE_PATH=$(config_value rclone_remote_path)
BACKUP_RETENTION_DAYS=$(config_value backup_retention_days)

require_value infra_repo "$INFRA_REPO"

mkdir -p "$ROOT"
cd "$ROOT"

# ---- Clone only the infra repo (api + ui come from GHCR as built images) ---
clone_or_pull() {
  local url="$1"
  local dir="$2"
  if [[ -d "$ROOT/$dir/.git" ]]; then
    log "Pulling $dir..."
    git -C "$ROOT/$dir" pull --ff-only
  else
    log "Cloning $dir from $url..."
    git clone --depth=1 "$url" "$ROOT/$dir"
  fi
}

clone_or_pull "$INFRA_REPO" infra/compose

# ---- Drop compose/.env from the rendered template --------------------------
log "Installing compose/.env..."
INFRA_DIR="$ROOT/infra/compose"
install -m 0600 "$ENV_FILE_SRC" "$INFRA_DIR/compose/.env"
chmod +x "$INFRA_DIR"/scripts/*.sh "$INFRA_DIR/compose/dev.sh" 2>/dev/null || true

# Symlink for predictable paths in docs/playbooks
ln -sfn "$INFRA_DIR" "$ROOT/infra"

# ---- Pull pre-built images from GHCR and start ----------------------------
log "Pulling production images from GHCR..."
cd "$INFRA_DIR"
WITH_WUD=1 STACK=prod ./scripts/compose-up.sh pull
log "Starting the prod stack..."
WITH_WUD=1 STACK=prod ./scripts/compose-up.sh -d

# ---- Optional: schedule nightly backups ------------------------------------
if [[ "$BACKUPS_ENABLED" == "true" ]]; then
  require_value rclone_remote_name "$RCLONE_REMOTE_NAME"
  require_value rclone_remote_path "$RCLONE_REMOTE_PATH"
  require_value backup_retention_days "$BACKUP_RETENTION_DAYS"

  log "Configuring nightly Postgres backups (rclone remote: $RCLONE_REMOTE_NAME)..."
  # Install rclone if missing
  if ! command -v rclone >/dev/null 2>&1; then
    curl -fsSL https://rclone.org/install.sh | bash
  fi
  # Cron entry: 03:15 daily, log into syslog.
  CRON_LINE="15 3 * * * root RCLONE_REMOTE_NAME=$RCLONE_REMOTE_NAME RCLONE_REMOTE_PATH=$RCLONE_REMOTE_PATH BACKUP_RETENTION_DAYS=$BACKUP_RETENTION_DAYS $INFRA_DIR/scripts/backup-wrapper.example.sh 2>&1 | logger -t boringstack-backup"
  echo "$CRON_LINE" > /etc/cron.d/boringstack-backup
  chmod 0644 /etc/cron.d/boringstack-backup
  log "Backup cron installed at /etc/cron.d/boringstack-backup. Configure rclone remotes with: rclone config"
else
  log "Backups disabled (set backups_enabled=true + rclone vars in terraform.tfvars to enable)."
fi

log "Bootstrap complete. Check status with: docker compose ls"
