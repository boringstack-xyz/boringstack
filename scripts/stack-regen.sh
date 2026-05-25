#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/stack-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/stack-lib.sh"

require_dir "api" "$BORINGSTACK_API_DIR"
require_dir "ui" "$BORINGSTACK_UI_DIR"
require_dir "docs" "$BORINGSTACK_DOCS_DIR"

step "ACL types (api → ui)"
(
  cd "$BORINGSTACK_API_DIR"
  bun run generate:acl-types
)
ok "ACL types regenerated"

if require_api_swagger; then
  step "OpenAPI types (api swagger → ui)"
  (
    cd "$BORINGSTACK_UI_DIR"
    OPENAPI_URL="${OPENAPI_URL:-http://localhost:3000/swagger/json}" bun run generate:api
  )
  ok "OpenAPI schema regenerated"
fi

step "lint-meta RULES.md (api)"
(
  cd "$BORINGSTACK_API_DIR"
  bun run generate:lint-meta-docs
)
ok "api RULES.md regenerated"

step "lint-meta RULES.md (ui)"
(
  cd "$BORINGSTACK_UI_DIR"
  bun run generate:lint-meta-docs
)
ok "ui RULES.md regenerated"

step "docs catalogs (lint-meta + scripts JSON)"
(
  cd "$BORINGSTACK_DOCS_DIR"
  BORINGSTACK_API_DIR="$BORINGSTACK_API_DIR" \
  BORINGSTACK_UI_DIR="$BORINGSTACK_UI_DIR" \
    bun run generate:docs-data
)
ok "docs data regenerated"

printf '\n'
c_green "regen complete — review git status in apps/{api,ui,docs}"
