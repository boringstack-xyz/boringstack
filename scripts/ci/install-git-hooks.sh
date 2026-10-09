#!/usr/bin/env bash
# Install the root-level git pre-push and commit-msg hooks for the monorepo.
#
# Run automatically by the root `package.json` postinstall on
# `bun install`. Safe to run manually:
#
#   bun run scripts/ci/install-git-hooks.sh
#
# pre-push delegates to scripts/ci/pre-push.sh, which fans out to each
# app's own husky gate based on what changed since `origin/main`.
# commit-msg delegates to scripts/ci/check-commit-title.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GIT_DIR="$(git -C "$ROOT" rev-parse --git-dir 2>/dev/null || echo "$ROOT/.git")"

# Worktrees: rev-parse returns the linked-worktree dir; fall back to
# the common dir so we install into the canonical hooks directory.
if [[ -f "$GIT_DIR/commondir" ]]; then
  COMMON_DIR_NAME="$(cat "$GIT_DIR/commondir")"
  case "$COMMON_DIR_NAME" in
    /*) COMMON_DIR="$COMMON_DIR_NAME" ;;
    *)  COMMON_DIR="$(cd "$GIT_DIR/$COMMON_DIR_NAME" && pwd)" ;;
  esac
  HOOKS_DIR="$COMMON_DIR/hooks"
else
  HOOKS_DIR="$GIT_DIR/hooks"
fi

mkdir -p "$HOOKS_DIR"
HOOK_FILE="$HOOKS_DIR/pre-push"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
# Auto-installed by scripts/ci/install-git-hooks.sh: fans out to per-app gates.

# Drain the "<local ref> <local sha> <remote ref> <remote sha>" lines git
# streams on our stdin. The gate below resolves its own range from
# origin/main and never reads them, and a hook that exits with stdin
# unread can leave git writing into a closed pipe: the push then aborts
# on SIGPIPE (141) with every gate reporting success.
cat >/dev/null

exec "$(git rev-parse --show-toplevel)/scripts/ci/pre-push.sh"
EOF

chmod +x "$HOOK_FILE"
echo "[install-git-hooks] Installed root pre-push hook → $HOOK_FILE"

COMMIT_MSG_HOOK="$HOOKS_DIR/commit-msg"

cat > "$COMMIT_MSG_HOOK" <<'EOF'
#!/usr/bin/env bash
# Auto-installed by scripts/ci/install-git-hooks.sh: Conventional Commits titles.
exec "$(git rev-parse --show-toplevel)/scripts/ci/check-commit-title.sh" --file "$1"
EOF

chmod +x "$COMMIT_MSG_HOOK"
echo "[install-git-hooks] Installed root commit-msg hook → $COMMIT_MSG_HOOK"
