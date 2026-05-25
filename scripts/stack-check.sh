#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/stack-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/stack-lib.sh"

FULL="${1:-}"
FAILED=()

run_check() {
  local label="$1"
  shift
  step "$label"
  if "$@"; then
    ok "$label"
  else
    FAILED+=("$label")
    c_red "✗ $label"
  fi
}

require_dir "api" "$BORINGSTACK_API_DIR"
require_dir "ui" "$BORINGSTACK_UI_DIR"
require_dir "docs" "$BORINGSTACK_DOCS_DIR"

run_check "ACL drift" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run generate:acl-types:check"
run_check "api lint-meta docs" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run check:lint-meta-docs"
run_check "api scripts docs" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run check:scripts-docs"

if require_api_swagger; then
  run_check "OpenAPI drift" bash -c "cd \"$BORINGSTACK_UI_DIR\" && OPENAPI_URL=http://localhost:3000/swagger/json bun run generate:api:check"
else
  c_yellow "  skipped OpenAPI drift — api-dev not on :3000"
fi

run_check "ui lint-meta docs" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run check:lint-meta-docs"
run_check "ui scripts docs" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run check:scripts-docs"

run_check "docs data" bash -c "cd \"$BORINGSTACK_DOCS_DIR\" && BORINGSTACK_API_DIR=\"$BORINGSTACK_API_DIR\" BORINGSTACK_UI_DIR=\"$BORINGSTACK_UI_DIR\" bun run check:docs-data"

if [[ "$FULL" == "--full" ]]; then
  run_check "api validate" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run validate"
  run_check "ui validate" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run validate"
  run_check "docs build:ci" bash -c "cd \"$BORINGSTACK_DOCS_DIR\" && BORINGSTACK_API_DIR=\"$BORINGSTACK_API_DIR\" BORINGSTACK_UI_DIR=\"$BORINGSTACK_UI_DIR\" bun run build:ci"
fi

printf '\n'
if ((${#FAILED[@]} > 0)); then
  c_red "check failed (${#FAILED[@]}):"
  for item in "${FAILED[@]}"; do
    c_red "  • $item"
  done
  c_yellow "run: bun run regen"
  exit 1
fi

c_green "check passed"
