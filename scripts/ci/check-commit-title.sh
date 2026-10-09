#!/usr/bin/env bash
# Enforce the Conventional Commits subject line on commits and PR titles.
#
#   scripts/ci/check-commit-title.sh "feat(api): add invoices"  # a title
#   scripts/ci/check-commit-title.sh --file .git/COMMIT_EDITMSG  # a message file
#
# The commit-msg hook (scripts/ci/install-git-hooks.sh) checks local commits;
# .github/workflows/pr-title.yml checks the PR title, which becomes the squash
# commit on main. Prose that only lives in a guide does not survive a change
# of agent or harness, so the convention is a gate, not a suggestion.

set -euo pipefail

TYPES='feat|fix|perf|refactor|test|docs|build|ci|chore|style|revert|deps'
PATTERN="^(${TYPES})(\([a-z0-9][a-z0-9._/-]*\))?!?: [^ ].*$"
# The pr-title workflow raises the limit for Dependabot, whose generated
# titles ("... in the docker-images group across 1 directory") run long.
MAX_LENGTH="${COMMIT_TITLE_MAX_LENGTH:-100}"
[[ "$MAX_LENGTH" =~ ^[1-9][0-9]*$ ]] || { echo "check-commit-title: bad COMMIT_TITLE_MAX_LENGTH: $MAX_LENGTH" >&2; exit 2; }

if [[ "${1:-}" == "--file" ]]; then
  [[ -n "${2:-}" && -f "$2" ]] || { echo "check-commit-title: no message file: ${2:-}" >&2; exit 2; }
  # First line that is neither blank nor a git comment.
  title="$(grep -v '^#' "$2" | grep -m1 -v '^[[:space:]]*$' || true)"
else
  title="${1:-}"
fi

# Git's own generated subjects pass untouched: autosquash markers, merges and
# reverts are rewritten or squashed away before they reach main.
case "$title" in
  "fixup! "* | "squash! "* | "amend! "* | "Merge "* | "Revert \""*) exit 0 ;;
esac

if [[ "$title" =~ $PATTERN ]] && (( ${#title} <= MAX_LENGTH )); then
  exit 0
fi

cat >&2 <<EOF
Commit title does not follow Conventional Commits:

  $title

Expected: <type>(<optional scope>)!?: <summary>, at most ${MAX_LENGTH} characters.
Types: ${TYPES//|/, }
Example: feat(api): invoices can be voided
EOF
exit 1
