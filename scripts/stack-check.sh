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

# `docs` is TEMPLATE-ONLY. The boringstack repo ships apps/docs (its own docs site)
# and checks it here; a product scaffolded FROM boringstack strips apps/docs (see
# .tsforge/scaffold-manifest.json `strip`), so its docs checks are skipped rather
# than hard-failing. Present ⇒ run them (the template); absent ⇒ this is a product.
HAS_DOCS=0
if [[ -d "$BORINGSTACK_DOCS_DIR" ]]; then
  HAS_DOCS=1
fi

run_check "ACL drift" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run generate:acl-types:check"
run_check "api lint-meta docs" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run check:lint-meta-docs"
run_check "api scripts docs" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run check:scripts-docs"

if require_api_swagger; then
  run_check "OpenAPI drift" bash -c "cd \"$BORINGSTACK_UI_DIR\" && OPENAPI_URL=http://localhost:7330/swagger/json bun run generate:api:check"
else
  c_yellow "  skipped OpenAPI drift — api-dev not on :7330"
fi

run_check "ui lint-meta docs" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run check:lint-meta-docs"
run_check "ui scripts docs" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run check:scripts-docs"

if [[ "$HAS_DOCS" == "1" ]]; then
  run_check "docs data" bash -c "cd \"$BORINGSTACK_DOCS_DIR\" && BORINGSTACK_API_DIR=\"$BORINGSTACK_API_DIR\" BORINGSTACK_UI_DIR=\"$BORINGSTACK_UI_DIR\" bun run check:docs-data"
fi

if [[ "$FULL" == "--full" ]]; then
  run_check "api validate" bash -c "cd \"$BORINGSTACK_API_DIR\" && bun run validate"
  run_check "ui validate" bash -c "cd \"$BORINGSTACK_UI_DIR\" && bun run validate"
  if [[ "$HAS_DOCS" == "1" ]]; then
    run_check "docs build:ci" bash -c "cd \"$BORINGSTACK_DOCS_DIR\" && BORINGSTACK_API_DIR=\"$BORINGSTACK_API_DIR\" BORINGSTACK_UI_DIR=\"$BORINGSTACK_UI_DIR\" bun run build:ci"
  fi
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
