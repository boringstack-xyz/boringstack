#!/usr/bin/env bash
#
# BoringStack agent host bootstrap. Runs once from cloud-init, and again by
# hand: sudo bash /opt/agent-host/agent-host.sh. Idempotent.
#
# Installs Bun (pinned), gh, Claude Code for the agent user, clones the
# repository, installs its dependencies and enables the factory timers.
# It stores no credentials. Logins (gh auth login, claude /login) are done by a
# person on the host; see docs/operations/remote-agents.md.

set -euo pipefail

LOG_PREFIX="[agent-host]"
CONFIG=/etc/agent-host.env

log() { echo "$LOG_PREFIX $*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "$LOG_PREFIX run as root" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG"

: "${AGENT_USER:?missing AGENT_USER}"
: "${REPO_URL:?missing REPO_URL}"
: "${BUN_VERSION:?missing BUN_VERSION}"

AGENT_HOME="/home/$AGENT_USER"
CHECKOUT="$AGENT_HOME/boringstack"

# ---------------------------------------------------------------- the user
# The agent user is not root. Docker group membership is root-equivalent on
# this host (it can start containers that mount the disk), which the factory's
# stacks need; read docs/operations/remote-agents.md before adding people.
if ! id "$AGENT_USER" >/dev/null 2>&1; then
  log "creating user $AGENT_USER"
  useradd --create-home --shell /bin/bash "$AGENT_USER"
fi
usermod -aG docker "$AGENT_USER"

# ---------------------------------------------------------------- Bun
# Pinned, and checked against Bun's published SHA256 list for that release.
# Fails closed when the list cannot be read.
case "$(dpkg --print-architecture)" in
  amd64) BUN_ARCH=x64 ;;
  arm64) BUN_ARCH=aarch64 ;;
  *)
    log "unsupported architecture: $(dpkg --print-architecture)"
    exit 1
    ;;
esac

if [[ "$(/usr/local/bin/bun --version 2>/dev/null || true)" != "$BUN_VERSION" ]]; then
  log "installing Bun $BUN_VERSION"
  BUN_ZIP="bun-linux-$BUN_ARCH.zip"
  BUN_BASE="https://github.com/oven-sh/bun/releases/download/bun-v$BUN_VERSION"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  curl -fsSL "$BUN_BASE/$BUN_ZIP" -o "$TMP/$BUN_ZIP"
  curl -fsSL "$BUN_BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  (cd "$TMP" && grep " $BUN_ZIP\$" SHASUMS256.txt | sha256sum -c -)

  unzip -q "$TMP/$BUN_ZIP" -d "$TMP/unpacked"
  install -m 0755 "$TMP/unpacked/bun-linux-$BUN_ARCH/bun" /usr/local/bin/bun
fi

BUN_NOW="$(/usr/local/bin/bun --version)"
if [[ "$BUN_NOW" != "$BUN_VERSION" ]]; then
  log "expected Bun $BUN_VERSION, found $BUN_NOW"
  exit 1
fi
log "Bun $BUN_NOW"

# ---------------------------------------------------------------- gh
if ! command -v gh >/dev/null 2>&1; then
  log "installing gh from GitHub's apt repository"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
  chmod a+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
  apt-get update
  apt-get install -y gh
fi

# ---------------------------------------------------------------- Claude Code
# The official native installer, run as the agent user. It installs under the
# agent's home, auto-updates in the background, and is found at
# ~/.local/bin/claude.
if [[ ! -x "$AGENT_HOME/.local/bin/claude" ]]; then
  log "installing Claude Code for $AGENT_USER"
  sudo -u "$AGENT_USER" -H bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
fi

# ---------------------------------------------------------------- checkout
if [[ ! -d "$CHECKOUT/.git" ]]; then
  log "cloning the repository"
  sudo -u "$AGENT_USER" -H git clone "$REPO_URL" "$CHECKOUT"
else
  log "updating the checkout (fast-forward only)"
  sudo -u "$AGENT_USER" -H git -C "$CHECKOUT" pull --ff-only
fi

sudo -u "$AGENT_USER" -H bash -c "cd '$CHECKOUT' && bun install --frozen-lockfile"

# ---------------------------------------------------------------- timers
install -m 0755 /opt/agent-host/add-person.sh /usr/local/bin/agent-add-person
systemctl daemon-reload
systemctl enable --now agent-factory-sweep.timer
systemctl enable --now agent-fleet.service

log "done. Next steps are in docs/operations/remote-agents.md (tier c)."
log "log in once as $AGENT_USER: gh auth login, then run claude and /login"
