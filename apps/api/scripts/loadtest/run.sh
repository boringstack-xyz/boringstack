#!/usr/bin/env bash
# Run the golden-path k6 load test against the local dev stack.
#
# Prereqs:
#   - k6 installed (`brew install k6` / scoop / package manager)
#   - dev stack running (`cd infra/compose/compose && ./dev.sh up -d`)
#   - api has E2E_TEST_ENDPOINTS_ENABLED=true (default in docker dev)
#
# Tune via env:
#   LOADTEST_BASE_URL=http://localhost:7331   # SPA proxy by default
#   E2E_TEST_ENDPOINTS_ENABLED=true           # mirror the api flag

set -euo pipefail

if ! command -v k6 >/dev/null 2>&1; then
  echo "ERROR: k6 is not installed. https://k6.io/docs/get-started/installation/" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BASE_URL="${LOADTEST_BASE_URL:-http://localhost:7331}"

# Probe the api before kicking off a 4-minute test. If the API is not
# reachable, k6's first iteration fails and the operator wastes the
# entire run window debugging connectivity.
if ! curl -fsS "${BASE_URL}/api/v1/capabilities" >/dev/null; then
  echo "ERROR: ${BASE_URL}/api/v1/capabilities is not reachable. Boot the stack first." >&2
  exit 1
fi

LOADTEST_BASE_URL="$BASE_URL" \
E2E_TEST_ENDPOINTS_ENABLED="${E2E_TEST_ENDPOINTS_ENABLED:-true}" \
  k6 run "$SCRIPT_DIR/api-golden-path.js"
