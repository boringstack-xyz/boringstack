#!/usr/bin/env bash
# Single source of truth for the compose guardrails. CI
# (infra-compose-validate-compose.yml) and the local pre-push gate both
# invoke THIS script, so the two layers cannot drift — the 2026-06-03
# incident (a guardrail env seeded in CI but not locally) is structurally
# impossible to repeat.
#
# Usage:
#   ./validate-guardrails.sh [check]
#
# Checks: healthchecks | digest-pins | credential-fallbacks | valkey-auth
#         | rooted-caps | no-new-privileges | prod-image-tags | all (default)
#
# Requires: docker (compose config rendering), python3.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/../compose"
cd "$COMPOSE_DIR"

CHECK="${1:-all}"

c_red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
c_green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
fail()    { c_red "✗ $*"; exit 1; }
ok()      { c_green "✓ $*"; }

render_prod_config() {
  docker compose -f docker-compose.yml --profile prod config --format json \
    > /tmp/guardrails-prod-config.json
}

render_full_config() {
  # Base prod stack plus every prod-capable overlay, so the hardening
  # checks see the optional services operators actually enable in
  # production (observability, GlitchTip, BullMQ, WUD). WUD is enabled by
  # default when STACK=prod (dev.sh), so it MUST be rendered here or the
  # privilege-escalation guardrail is blind to the one service that mounts
  # the docker socket. Dev-only overlays (mailpit) are deliberately absent.
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.observability.yml \
    -f docker-compose.glitchtip.yml \
    -f docker-compose.bullmq.yml \
    -f docker-compose.wud.yml \
    --profile prod \
    --profile observability \
    --profile glitchtip-prod \
    --profile bullmq \
    --profile wud \
    config --format json \
    > /tmp/guardrails-full-config.json 2>/dev/null
}

check_healthchecks() {
  render_prod_config
  python3 - <<'EOF'
import json

with open("/tmp/guardrails-prod-config.json", encoding="utf-8") as handle:
    services = json.load(handle)["services"]

missing = sorted(
    name
    for name, svc in services.items()
    if svc.get("restart") != "no" and "healthcheck" not in svc
)

if missing:
    raise SystemExit("prod services missing healthcheck: " + ", ".join(missing))

print("healthcheck present on: " + ", ".join(sorted(services)))
EOF
  ok "healthchecks"
}

check_digest_pins() {
  python3 - <<'EOF'
import glob
import re

# Literal image refs must pin a @sha256 digest and must not carry the
# floating :latest tag (even alongside a digest — the digest wins, but
# the tag misdocuments what is pinned). Interpolated refs (with a
# dollar-brace variable) are validated at runtime by the stack scripts.
IMAGE_RE = re.compile(r"^\s+image:\s*(?P<ref>[^\s#]+)")
bad: list[str] = []

for path in sorted(glob.glob("docker-compose*.yml")):
    with open(path, encoding="utf-8") as handle:
        for lineno, line in enumerate(handle, start=1):
            match = IMAGE_RE.match(line)
            if match is None:
                continue
            ref = match.group("ref")
            if "${" in ref:
                continue
            if "@sha256:" not in ref:
                bad.append(f"{path}:{lineno}: {ref} (no digest pin)")
            elif ":latest@" in ref:
                bad.append(f"{path}:{lineno}: {ref} (floating :latest tag)")

if bad:
    raise SystemExit("unpinned compose images:\n" + "\n".join(bad))

print("all literal compose image refs digest-pinned")
EOF
  ok "digest-pins"
}

check_credential_fallbacks() {
  python3 - <<'EOF'
import glob
import re

# Secret-named env vars must not ship a literal fallback — a
# dollar-brace VAR with a :-hunter2 default in a published template is
# a credential leak. Use the :?message form and let dev.sh generate dev
# values. The allowlist documents the deliberate dev-only placeholders
# that dev.sh fail-closes in prod.
SECRET_FALLBACK_RE = re.compile(
    r"\$\{(?P<var>[A-Za-z0-9_]*(?:PASSWORD|SECRET|_TOKEN|_KEY)[A-Za-z0-9_]*):-(?P<fallback>[^}]+)\}"
)
ALLOWED = {
    # Dev DB password documented in .env.example; dev.sh requires an
    # explicit POSTGRES_PASSWORD when STACK=prod.
    ("POSTGRES_PASSWORD", "app_dev_password"),
    # api-dev / api-migrate-dev only run under the dev profile; prod api
    # reads api.prod.env instead.
    ("API_DEV_JWT_SECRET", "docker-compose-api-dev-jwt-secret-keys"),
    ("API_DEV_MFA_ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="),
}
bad: list[str] = []

for path in sorted(glob.glob("docker-compose*.yml")):
    with open(path, encoding="utf-8") as handle:
        for lineno, line in enumerate(handle, start=1):
            for match in SECRET_FALLBACK_RE.finditer(line):
                pair = (match.group("var"), match.group("fallback"))
                if pair in ALLOWED:
                    continue
                bad.append(path + ":" + str(lineno) + ": $" + "{" + pair[0] + ":-...}")

if bad:
    raise SystemExit("hardcoded credential fallbacks in compose:\n" + "\n".join(bad))

print("no unallowed credential fallbacks in compose files")
EOF
  ok "credential-fallbacks"
}

check_valkey_auth() {
  grep -A 3 'command:' docker-compose.yml | grep -q -- '--requirepass' \
    || fail "valkey command does not enforce --requirepass"
  grep -q 'VALKEY_PASSWORD:?VALKEY_PASSWORD required in prod' dev.sh \
    || fail "dev.sh prod guard for VALKEY_PASSWORD missing"
  ok "valkey-auth"
}

check_rooted_caps() {
  render_prod_config
  python3 - <<'EOF'
import json

# `user: root` is only tolerated when the root process is neutered:
# every capability dropped (allowlist re-adds only), plus
# no-new-privileges. Anything less is a full-power root container one
# RCE away from the host.
with open("/tmp/guardrails-prod-config.json", encoding="utf-8") as handle:
    services = json.load(handle)["services"]

bad: list[str] = []

for name, svc in services.items():
    if svc.get("user") not in ("root", "0", "0:0"):
        continue
    if "ALL" not in (svc.get("cap_drop") or []):
        bad.append(f"{name}: user root without cap_drop: [ALL]")
    if "no-new-privileges:true" not in (svc.get("security_opt") or []):
        bad.append(f"{name}: user root without no-new-privileges")

if bad:
    raise SystemExit("rooted services not neutered:\n" + "\n".join(bad))

print("all rooted prod services drop capabilities")
EOF
  ok "rooted-caps"
}

check_no_new_privileges() {
  render_full_config
  python3 - <<'EOF'
import json

# Every long-running service — base AND optional overlay — must block
# privilege escalation. The base stack (traefik/api/ui) already sets it;
# the observability/GlitchTip/BullMQ overlays did not, leaving an RCE in
# Grafana or GlitchTip one setuid binary away from host escalation.
# One-shot jobs (restart: no) are exempt; document any other exception.
with open("/tmp/guardrails-full-config.json", encoding="utf-8") as handle:
    services = json.load(handle)["services"]

ALLOWED: set[str] = set()

missing = sorted(
    name
    for name, svc in services.items()
    if svc.get("restart") != "no"
    and name not in ALLOWED
    and "no-new-privileges:true" not in (svc.get("security_opt") or [])
)

if missing:
    raise SystemExit(
        "services missing security_opt no-new-privileges:true: " + ", ".join(missing)
    )

print("no-new-privileges on: " + ", ".join(sorted(services)))
EOF
  ok "no-new-privileges"
}

check_prod_image_tags() {
  # Behavioral test of dev.sh's fail-closed prod guard, with a curated
  # env so only the image-tag checks are exercised. ENV_FILE diverts the
  # .env sourcing so the operator's real values never leak in.
  local guard_env=(
    STACK=prod
    WITH_GLITCHTIP=0
    WITH_OBSERVABILITY=0
    POSTGRES_USER=app
    POSTGRES_PASSWORD=ci-guardrail-placeholder
    POSTGRES_DB=app
    JWT_SECRET=ci-guardrail-placeholder-padded-to-32-chars
    MFA_ENCRYPTION_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
    FRONTEND_URL=https://example.com
    PUBLIC_API_URL=https://example.com/api
    PUBLIC_UI_HOST=example.com
    ACME_EMAIL=ops@example.com
    VALKEY_PASSWORD=ci-guardrail-placeholder
    ENV_FILE=/tmp/guardrails-empty.env
  )

  : > /tmp/guardrails-empty.env
  chmod +x dev.sh

  local output

  # 1. Missing tags must fail closed and name the missing var.
  if output=$(env "${guard_env[@]}" ./dev.sh config --quiet 2>&1); then
    fail "prod accepted unset image tags"
  fi
  echo "$output" | grep -q "API_IMAGE_TAG" \
    || fail "error does not mention API_IMAGE_TAG: $output"

  # 2. latest must be rejected explicitly.
  if output=$(env "${guard_env[@]}" API_IMAGE_TAG=latest UI_IMAGE_TAG=latest ./dev.sh config --quiet 2>&1); then
    fail "prod accepted latest image tags"
  fi
  echo "$output" | grep -q "must be pinned in prod" \
    || fail "latest rejection message missing: $output"

  # 3. Pinned tags pass.
  env "${guard_env[@]}" API_IMAGE_TAG=v0.1.0 UI_IMAGE_TAG=v0.1.0 ./dev.sh config --quiet \
    || fail "prod rejected properly pinned tags"

  ok "prod-image-tags"
}

case "$CHECK" in
  healthchecks)         check_healthchecks ;;
  digest-pins)          check_digest_pins ;;
  credential-fallbacks) check_credential_fallbacks ;;
  valkey-auth)          check_valkey_auth ;;
  rooted-caps)          check_rooted_caps ;;
  no-new-privileges)    check_no_new_privileges ;;
  prod-image-tags)      check_prod_image_tags ;;
  all)
    check_digest_pins
    check_credential_fallbacks
    check_valkey_auth
    check_healthchecks
    check_rooted_caps
    check_no_new_privileges
    check_prod_image_tags
    c_green "✓ all compose guardrails passed"
    ;;
  *)
    fail "unknown check: $CHECK (healthchecks|digest-pins|credential-fallbacks|valkey-auth|rooted-caps|no-new-privileges|prod-image-tags|all)"
    ;;
esac
