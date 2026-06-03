#!/usr/bin/env bash
# Rebrand the BoringStack template for a fork. Run once per new project.
#
# Replaces every cosmetic occurrence of the upstream identifiers with the
# names you pass in:
#
#   - boringstack / BoringStack             → <project> / <Project>
#   - boringstack-api / boringstack-ui      → <project>-api / <project>-ui
#   - boringstack-xyz (GHCR / repo owner)   → <ghcr-owner>
#   - "API Template" (Swagger title)        → <Project>
#   - noreply@example.com                   → noreply@<domain>
#   - demo@example.com (seeded demo user)   → demo@<domain>
#
# The compose stack name (boringstack-infra) and all container/volume
# names rename via the bare boringstack → <project> rule below.
#
# Coverage is inventory-driven (every file matching the identifiers, minus
# the exclude list below) and self-verified: the script fails if any
# upstream identifier survives the rewrite. Bare example.com docstring URLs
# are untouched — only noreply@/demo@ mailbox forms are rewritten.
#
# Idempotent: re-running with the same names is a no-op.
#
# Usage:
#   ./scripts/rename-project.sh <project> <ghcr-owner> <domain>
#
# Examples:
#   ./scripts/rename-project.sh acme acme-corp acme.com
#   ./scripts/rename-project.sh helo helo-llc helo.app
#
# After running:
#   bun install                       # at every apps/* root
#   bash scripts/stack-check.sh       # cross-repo drift
#   git diff                          # eyeball before committing
#
# Dry run: pass DRY_RUN=1 to print the planned edits without writing.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 3 ]]; then
  cat >&2 <<'USAGE'
Usage: ./scripts/rename-project.sh <project> <ghcr-owner> <domain>

  <project>     short-name (lowercase, hyphens ok) used in package names,
                docker stack name, and as the API "Template" display name.
  <ghcr-owner>  the GitHub user or org that will host the GHCR images.
                Usually matches the org that hosts the repo fork.
  <domain>      the apex domain you'll deploy to. Used as the default
                sender + demo-user email domain.

Examples:
  ./scripts/rename-project.sh acme       acme-corp  acme.com
  ./scripts/rename-project.sh widgetly   widgetly   widgetly.io
USAGE
  exit 1
fi

PROJECT="$1"
GHCR_OWNER="$2"
DOMAIN="$3"

DRY_RUN="${DRY_RUN:-0}"

if ! [[ "$PROJECT" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; then
  echo "ERROR: <project> must be lowercase, start with a letter, hyphens ok, ≤31 chars." >&2
  exit 1
fi

if ! [[ "$GHCR_OWNER" =~ ^[A-Za-z0-9-]+$ ]]; then
  echo "ERROR: <ghcr-owner> must contain only letters, digits, and hyphens." >&2
  exit 1
fi

if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "ERROR: <domain> must be a bare apex domain (no scheme, no www)." >&2
  exit 1
fi

# Build the title-cased variant of the project name. Splits on hyphens and
# capitalises each segment, then joins with no separator: "boring-stack" →
# "BoringStack". Single-segment names get a single capital.
project_title() {
  local raw="$1"
  python3 -c "import sys; print(''.join(s.capitalize() for s in sys.argv[1].split('-')))" "$raw" 2>/dev/null \
    || awk -v s="$raw" 'BEGIN{
        n=split(s,a,"-")
        out=""
        for(i=1;i<=n;i++) out=out toupper(substr(a[i],1,1)) substr(a[i],2)
        print out
      }'
}

PROJECT_TITLE="$(project_title "$PROJECT")"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY RUN — no files will be modified."
fi

echo "Rename plan:"
printf '  %-26s → %s\n' "boringstack"        "$PROJECT"
printf '  %-26s → %s\n' "BoringStack"        "$PROJECT_TITLE"
printf '  %-26s → %s\n' "boringstack-api"    "$PROJECT-api"
printf '  %-26s → %s\n' "boringstack-ui"     "$PROJECT-ui"
printf '  %-26s → %s\n' "boringstack-xyz"    "$GHCR_OWNER"
printf '  %-26s → %s\n' "API Template"       "$PROJECT_TITLE"
printf '  %-26s → %s\n' "noreply@example.com" "noreply@$DOMAIN"
printf '  %-26s → %s\n' "demo@example.com"   "demo@$DOMAIN"
echo

# Inventory-driven: rewrite EVERY file that carries an upstream identifier,
# minus an explicit exclude list. The previous static allowlist silently
# missed new files (metrics labels, tracer names, dev.sh project names);
# with an inventory the failure mode is gone — and the zero-hits assertion
# at the end proves it on every run.
#
# Exclusions:
#   - .git / generated trees (node_modules, dist, build, coverage, .astro,
#     .wrangler, .audit) — regenerated or never shipped.
#   - bun.lock — rerun `bun install` after the rename instead.
#   - CHANGELOG.md — history stays history.
#   - LICENSE — the MIT copyright line keeps the original attribution.
#   - this script itself (it must keep the upstream literals to find them).
IDENTIFIER_PATTERN='boringstack|BoringStack|API Template|noreply@example\.com|demo@example\.com'
GREP_EXCLUDES=(
  -I
  --exclude-dir=.git
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=coverage
  --exclude-dir=.astro
  --exclude-dir=.wrangler
  --exclude-dir=.audit
  --exclude=bun.lock
  --exclude=CHANGELOG.md
  --exclude=LICENSE
  --exclude=rename-project.sh
)

inventory_files() {
  grep -rlE "$IDENTIFIER_PATTERN" "${GREP_EXCLUDES[@]}" . 2>/dev/null || true
}

# Apply the substitutions to a single file in-place. We orchestrate
# multiple sed expressions because BSD/macOS and GNU sed both accept this
# layout. The order matters — longer matches first so "boringstack-api"
# isn't truncated to "<project>-api" via the bare "boringstack" rule.
apply_to_file() {
  local file="$1"

  [[ -f "$file" ]] || return 0

  if [[ "$DRY_RUN" == "1" ]]; then
    # inventory_files already guarantees a match
    echo "  would edit: $file"
    return 0
  fi

  # macOS sed needs `-i ''`, GNU sed wants `-i` alone. Pick the right one.
  if sed --version >/dev/null 2>&1; then
    sed_inplace=(-i)
  else
    sed_inplace=(-i '')
  fi

  sed "${sed_inplace[@]}" \
    -e "s/boringstack-xyz/${GHCR_OWNER}/g" \
    -e "s/boringstack-api/${PROJECT}-api/g" \
    -e "s/boringstack-ui/${PROJECT}-ui/g" \
    -e "s/BoringStack API/${PROJECT_TITLE} API/g" \
    -e "s/BoringStack UI/${PROJECT_TITLE} UI/g" \
    -e "s/BoringStack/${PROJECT_TITLE}/g" \
    -e "s/boringstack/${PROJECT}/g" \
    -e "s/\"API Template\"/\"${PROJECT_TITLE}\"/g" \
    -e "s/APP_NAME=API Template/APP_NAME=${PROJECT_TITLE}/g" \
    -e "s/APP_NAME: API Template/APP_NAME: ${PROJECT_TITLE}/g" \
    -e "s/noreply@example\.com/noreply@${DOMAIN}/g" \
    -e "s/demo@example\.com/demo@${DOMAIN}/g" \
    "$file"
}

while IFS= read -r path; do
  apply_to_file "$path"
done < <(inventory_files)

if [[ "$DRY_RUN" == "1" ]]; then
  echo
  echo "Dry run complete. Re-run without DRY_RUN=1 to apply."
  exit 0
fi

# Self-verification: after a real run, no upstream identifier may survive
# outside the excluded paths. If one does, the rename has a coverage bug —
# fail loudly instead of shipping a half-branded fork.
leftover="$(inventory_files)"
if [[ -n "$leftover" ]]; then
  echo "ERROR: rename incomplete — upstream identifiers survive in:" >&2
  echo "$leftover" >&2
  exit 1
fi

cat <<EOF

Rename complete. Next:
  1. Review the diff:  git diff
  2. Reinstall deps:   (cd apps/api && bun install) && (cd apps/ui && bun install) && (cd apps/docs && bun install)
  3. Regen catalogs:   bun run regen
  4. Drift gate:       bun run check
  5. Boot the stack:   ./setup.sh --up

Things this script deliberately does NOT touch:
  - LICENSE attribution (the MIT copyright line keeps the original author)
  - CHANGELOG.md history
  - bun.lock files (step 2 regenerates them)
  - Sentry / GlitchTip DSNs (your real DSN goes in compose/.env)
EOF
