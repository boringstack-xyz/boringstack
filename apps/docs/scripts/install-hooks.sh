#!/usr/bin/env bash
# Installs the local pre-push gate. Run once after cloning:
#
#   ./scripts/install-hooks.sh
#
# Re-running is safe; it just overwrites the symlink. To uninstall:
# `rm .git/hooks/pre-push`. To bypass for a single push: `git push --no-verify`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIT_DIR="$ROOT/.git"

if [ ! -d "$GIT_DIR" ]; then
  echo "✗ no .git directory at $GIT_DIR. Run from a checked-out repo" >&2
  exit 1
fi

HOOK="$GIT_DIR/hooks/pre-push"
TARGET="../../scripts/pre-push.sh"

mkdir -p "$GIT_DIR/hooks"
ln -sf "$TARGET" "$HOOK"
chmod +x "$ROOT/scripts/pre-push.sh"

echo "✓ pre-push hook installed → $HOOK -> $TARGET"
