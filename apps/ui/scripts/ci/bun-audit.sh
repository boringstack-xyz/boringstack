#!/usr/bin/env bash
# Run `bun audit` honoring osv-scanner.toml IgnoredVulns (GHSA ids).
# osv-scanner and bun audit otherwise diverge: osv reads the toml allowlist,
# bun audit does not — so CI would fail on accepted-risk findings.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="$ROOT/osv-scanner.toml"

ignores=()
if [[ -f "$CONFIG" ]]; then
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    ignores+=(--ignore="$id")
  done < <(grep -E '^id = "' "$CONFIG" | sed -E 's/^id = "([^"]+)".*/\1/')
fi

if ((${#ignores[@]})); then
  echo "bun audit: applying ${#ignores[@]} ignore(s) from osv-scanner.toml"
fi

exec bun audit --audit-level=high "${ignores[@]}"
