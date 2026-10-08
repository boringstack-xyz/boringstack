#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export BORINGSTACK_ROOT="$ROOT"
export BORINGSTACK_API_DIR="${BORINGSTACK_API_DIR:-$ROOT/apps/api}"
export BORINGSTACK_UI_DIR="${BORINGSTACK_UI_DIR:-$ROOT/apps/ui}"
export BORINGSTACK_DOCS_DIR="${BORINGSTACK_DOCS_DIR:-$ROOT/apps/docs}"
export BORINGSTACK_PACKAGES_DIR="${BORINGSTACK_PACKAGES_DIR:-$ROOT/packages}"
export BORINGSTACK_INFRA_COMPOSE_DIR="${BORINGSTACK_INFRA_COMPOSE_DIR:-$ROOT/infra/compose/compose}"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }

fail() { c_red "✗ $*"; exit 1; }
ok()   { c_green "✓ $*"; }
step() { printf '\n'; c_blue "▶ $*"; }

require_dir() {
  local label="$1"
  local path="$2"
  if [[ ! -d "$path" ]]; then
    fail "$label not found at $path"
  fi
}

probe_tcp() { nc -z "$1" "$2" 2>/dev/null; }

require_api_swagger() {
  export OPENAPI_URL="${OPENAPI_URL:-http://localhost:7330/swagger/json}"
  if curl --fail --silent --output /dev/null --connect-timeout 2 --max-time 5 "$OPENAPI_URL"; then
    return 0
  fi
  c_yellow "  API schema unavailable — OpenAPI regen/check skipped"
  c_yellow "  start the API or set OPENAPI_URL; strict evidence: bun run agent:verify -- --json"
  return 1
}

# Workspace packages are every packages/<name>/ that has a package.json. A
# missing packages/ directory means there are none, which is not an error.
list_packages() {
  local dir
  for dir in "$BORINGSTACK_PACKAGES_DIR"/*/; do
    if [[ -f "${dir}package.json" ]]; then
      printf '%s\n' "${dir%/}"
    fi
  done
}

# Each package must define a `validate` script (its own lint, typecheck and
# tests). Runs all of them and returns non-zero if any fails.
validate_packages() {
  local dir name failed=0
  while IFS= read -r dir; do
    name="$(basename "$dir")"
    step "package $name validate"
    if (cd "$dir" && bun run validate); then
      ok "package $name validate"
    else
      c_red "✗ package $name validate"
      failed=1
    fi
  done < <(list_packages)
  return "$failed"
}
