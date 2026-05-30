#!/usr/bin/env bash
# Local mirror of docs CI. Runs what docs-linkcheck.yml runs so a pre-push
# failure matches CI, using the monorepo apps/ui and apps/api checkouts.
#
# Stages:
#   1. Docs data : bun run check:docs-data against local apps
#   2. Dependency: osv-scanner against bun.lock
#   3. Build     : bun run build (Astro/Starlight)
#   4. Linkcheck : lychee against dist (when installed)
#
# Bypass: `git push --no-verify`.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DOCS_DIR="$ROOT/apps/docs"
cd "$DOCS_DIR"

BORINGSTACK_UI_DIR="$ROOT/apps/ui"
BORINGSTACK_API_DIR="$ROOT/apps/api"

c_red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()  { printf '\033[1;34m%s\033[0m\n' "$*"; }

step()    { printf '\n'; c_blue "▶ $*"; }
fail()    { c_red   "✗ $*"; exit 1; }
ok()      { c_green "✓ $*"; }

step "1/4 Docs data (monorepo apps)"
BORINGSTACK_UI_DIR="$BORINGSTACK_UI_DIR" \
BORINGSTACK_API_DIR="$BORINGSTACK_API_DIR" \
  bun run check:docs-data || fail "docs data drift: run bun run generate:docs-data from apps/docs"
ok "docs data matches apps/ui + apps/api"

step "2/4 Dependency vulnerability scan"
if ! command -v osv-scanner >/dev/null 2>&1; then
  fail "osv-scanner not installed. Install with: brew install osv-scanner"
fi
osv-scanner --config="$DOCS_DIR/osv-scanner.toml" --lockfile="$DOCS_DIR/bun.lock"
ok "osv-scanner clean"

step "3/4 Production build"
BORINGSTACK_UI_DIR="$BORINGSTACK_UI_DIR" \
BORINGSTACK_API_DIR="$BORINGSTACK_API_DIR" \
  bun run build:ci || fail "build failed: run bun run generate:docs-data from apps/docs"
ok "build passed"

step "4/4 Internal link check (lychee)"
if ! command -v lychee >/dev/null 2>&1; then
  c_blue "  skipped: lychee not installed (brew install lychee). CI still runs the check."
else
  lychee --no-progress --offline --root-dir "$DOCS_DIR/dist" "$DOCS_DIR/dist/**/*.html"
  ok "linkcheck passed"
fi

printf '\n'
c_green "✓ pre-push: all gates passed"
