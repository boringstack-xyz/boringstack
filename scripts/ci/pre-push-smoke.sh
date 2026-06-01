#!/usr/bin/env bash
# Path-gated smoke + Playwright gate. Closes the last parity hole
# between `bun run validate` (NODE_ENV=test, no compose) and CI's
# `full-stack-smoke` workflow (NODE_ENV=development, real Docker stack,
# real Playwright). The MFA_ENCRYPTION_KEY missing-env bug shipped
# because validate passed and only the smoke workflow exercised the
# api-dev container env — pre-push couldn't see the divergence.
#
# Two design rules:
#
#   1. Path-gated, not always-on. Smoke takes ~60s to boot from cold
#      and Playwright is another ~30s on the targeted slice. We only
#      pay that cost when the change actually touches a layer the
#      smoke workflow covers: api/auth, lib/crypto, compose, e2e
#      specs, ui/auth, ui/api-client.
#
#   2. Reuse an already-running dev stack. If you're mid-dev with
#      `./dev.sh up`, the gate runs Playwright against the live
#      stack instead of demolishing it to boot a parallel smoke
#      stack on the same ports. Cuts a typical run from 90s to ~20s
#      and never disrupts the user's session.
#
# Bypass: `git push --no-verify`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

c_red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_blue()   { printf '\033[1;34m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }

step() { printf '\n'; c_blue "▶ $*"; }
fail() { c_red   "✗ $*"; exit 1; }
ok()   { c_green "✓ $*"; }
note() { c_yellow "· $*"; }

UPSTREAM="${UPSTREAM:-origin/main}"

if git rev-parse --verify "$UPSTREAM" >/dev/null 2>&1; then
  CHANGED_PATHS="$(git diff --name-only "$UPSTREAM"...HEAD)"
else
  CHANGED_PATHS=""
fi

paths_match() {
  local pattern="$1"
  # Empty CHANGED_PATHS means HEAD == origin/main (no commits to push)
  # or the upstream ref is missing. Smoke + Playwright is expensive
  # enough that "run everything when uncertain" is the wrong default;
  # short-circuit instead. Pre-push from a real branch always has a
  # non-empty diff range.
  if [[ -z "$CHANGED_PATHS" ]]; then
    return 1
  fi
  echo "$CHANGED_PATHS" | grep -qE "$pattern"
}

# ─── Decide what (if anything) needs to run ────────────────────────────────
#
# The Playwright spec map below mirrors the CI `full-stack-smoke` step.
# Path → which e2e spec(s) to run. Empty match list means smoke is
# not needed for this push and the gate short-circuits.

SPECS_TO_RUN=()

# MFA-shaped changes: run the mfa spec. This is the literal regression
# the env-divergence bug burned in CI; gating it here is the point of
# this whole script.
if paths_match '(^apps/api/src/api/auth/mfa\.|^apps/api/src/api/auth/services/mfa\.|^apps/api/src/lib/crypto/|^apps/ui/e2e/mfa\.spec\.ts$|^apps/ui/src/features/accounts/components/SettingsPage/MfaSection/|^apps/ui/src/features/auth/components/LoginPage/MfaChallengeForm/)'; then
  SPECS_TO_RUN+=("e2e/mfa.spec.ts")
fi

# Other auth flows: register/login/verify/password-reset/oauth.
if paths_match '(^apps/api/src/api/auth/(auth|email-verification|password-reset|oauth|session)\.|^apps/ui/src/features/auth/|^apps/ui/e2e/(auth|signup|verify-email|password-reset|oauth)\.spec\.ts$)'; then
  for spec in e2e/auth.spec.ts e2e/signup.spec.ts e2e/verify-email.spec.ts e2e/password-reset.spec.ts e2e/oauth.spec.ts; do
    if [[ -f "apps/ui/${spec}" ]]; then
      SPECS_TO_RUN+=("${spec}")
    fi
  done
fi

# Compose / infra changes: run the full portable e2e net. Visual
# regression specs (visual.spec.ts) are deliberately excluded —
# their snapshots are baked against the CI runner's font rendering
# and Chromium build, and they'll always diff against a local
# laptop. Visual regression stays a CI-only check.
if paths_match '(^infra/compose/|^apps/api/Dockerfile|^apps/ui/Dockerfile|^apps/ui/nginx\.)'; then
  for spec in apps/ui/e2e/*.spec.ts; do
    name="${spec##*/}"
    if [[ "$name" != "visual.spec.ts" ]]; then
      SPECS_TO_RUN+=("e2e/${name}")
    fi
  done
fi

# OpenAPI client regeneration touches the contract between the two
# apps; the typed client failing is the single thing that breaks
# every ui-side test.
if paths_match '(^apps/api/src/api/.*\.routes\.ts$|^apps/api/src/api/.*\.schemas\.ts$|^apps/ui/src/lib/api/)'; then
  SPECS_TO_RUN+=("e2e/auth.spec.ts" "e2e/account-pages.spec.ts")
fi

# Deduplicate (preserve order).
if [[ ${#SPECS_TO_RUN[@]} -gt 0 ]]; then
  SEEN=()
  DEDUPED=()
  for item in "${SPECS_TO_RUN[@]}"; do
    if [[ " ${SEEN[*]:-} " != *" ${item} "* ]]; then
      SEEN+=("$item")
      DEDUPED+=("$item")
    fi
  done
  SPECS_TO_RUN=("${DEDUPED[@]}")
fi

if [[ ${#SPECS_TO_RUN[@]} -eq 0 ]]; then
  step "Smoke pre-push gate"
  ok "No smoke-relevant changes — skipping."
  exit 0
fi

# ─── Preflight ─────────────────────────────────────────────────────────────

step "Smoke pre-push gate"
note "Specs to run:"
for spec in "${SPECS_TO_RUN[@]}"; do
  printf '    %s\n' "$spec"
done

if ! command -v docker >/dev/null 2>&1; then
  fail "docker not installed. Install OrbStack or Docker Desktop and start it."
fi

if ! docker info >/dev/null 2>&1; then
  fail "docker daemon not running. Start OrbStack / Docker Desktop and retry."
fi

# ─── Detect existing stack, decide boot strategy ───────────────────────────

STACK_BOOTED_BY_US=0

probe_api() { curl -fsS http://localhost:7330/health -o /dev/null 2>&1; }
probe_ui()  { curl -fsS http://localhost:7331/ -o /dev/null 2>&1; }

if probe_api && probe_ui; then
  ok "Stack already up on :7330 + :7331 — reusing it."
else
  step "Booting smoke stack (STACK=smoke ./dev.sh up -d --build)"
  ( cd infra/compose/compose && STACK=smoke ./dev.sh up -d --build )
  STACK_BOOTED_BY_US=1

  note "Waiting up to 90s for API health on :7330"
  for i in $(seq 1 90); do
    if probe_api; then
      ok "API healthy after ${i}s"
      break
    fi
    if [[ $i -eq 90 ]]; then
      fail "API did not become healthy in 90s. Check 'cd infra/compose/compose && docker compose --profile smoke logs api-dev'."
    fi
    sleep 1
  done

  note "Waiting up to 60s for UI on :7331"
  for i in $(seq 1 60); do
    if probe_ui; then
      ok "UI ready after ${i}s"
      break
    fi
    if [[ $i -eq 60 ]]; then
      fail "UI did not become reachable in 60s."
    fi
    sleep 1
  done
fi

# ─── Run Playwright ────────────────────────────────────────────────────────

teardown() {
  if [[ $STACK_BOOTED_BY_US -eq 1 ]]; then
    note "Tearing down the smoke stack we booted"
    ( cd infra/compose/compose && STACK=smoke ./dev.sh down -v ) || true
  fi
}

trap teardown EXIT

step "Running Playwright against the live stack"
(
  cd apps/ui
  # PLAYWRIGHT_REUSE_SERVER tells Playwright not to spawn its own
  # `bun run dev` — the dev/smoke stack is already serving on :7331.
  PLAYWRIGHT_REUSE_SERVER="true" \
    bunx playwright test "${SPECS_TO_RUN[@]}" \
    --project=chromium \
    --reporter=line
)

ok "Smoke pre-push gate passed"
