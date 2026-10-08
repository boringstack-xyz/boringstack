#!/usr/bin/env bash
# Local mirror of apps-site-validate.yml. Runs the same validate gate as CI.
# Bypass: `git push --no-verify`.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/apps/site"

printf '\n\033[1;34m▶ site: install\033[0m\n'
bun install --frozen-lockfile

printf '\n\033[1;34m▶ site: validate (format, types, unit tests, build, output tests)\033[0m\n'
bun run validate

printf '\n\033[1;32m✓ site pre-push: all gates passed\033[0m\n'
