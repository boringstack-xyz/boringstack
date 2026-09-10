#!/usr/bin/env bash
# Run `bun audit` honoring osv-scanner.toml IgnoredVulns (GHSA ids).
# osv-scanner and bun audit otherwise diverge: osv reads the toml allowlist,
# bun audit does not — so CI would fail on accepted-risk findings.
#
# An entry is honoured only while its `ignoreUntil` is in the future. The
# previous version read `id` and nothing else, so the re-evaluation dates the
# file header demands were decorative: every accepted risk stayed suppressed
# forever, and the two live entries would have gone on hiding their
# advisories indefinitely past their stated expiry. An entry with no date, or
# with a date this cannot parse, is NOT honoured — a missing expiry is the
# same permanent suppression by another route.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="$ROOT/osv-scanner.toml"

# Canonical UTC instant. ISO-8601 UTC strings of this exact shape compare
# chronologically as plain strings, which avoids depending on GNU `date -d`
# (absent on macOS) purely to order two timestamps.
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ISO_UTC='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'

ignores=()
expired=()

consider() {
  local id="$1" until="$2"

  [[ -n "$id" ]] || return 0

  if [[ -z "$until" ]]; then
    expired+=("$id (no ignoreUntil)")
    return 0
  fi

  if [[ ! "$until" =~ $ISO_UTC ]]; then
    expired+=("$id (unparseable ignoreUntil: $until)")
    return 0
  fi

  if [[ "$until" > "$NOW" ]]; then
    ignores+=(--ignore="$id")
  else
    expired+=("$id (expired $until)")
  fi
}

if [[ -f "$CONFIG" ]]; then
  cur_id=""
  cur_until=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      '[[IgnoredVulns]]'*)
        consider "$cur_id" "$cur_until"
        cur_id=""
        cur_until=""
        ;;
      'id = "'*)
        cur_id="$(sed -E 's/^id = "([^"]+)".*/\1/' <<<"$line")"
        ;;
      'ignoreUntil = "'*)
        cur_until="$(sed -E 's/^ignoreUntil = "([^"]+)".*/\1/' <<<"$line")"
        ;;
    esac
  done <"$CONFIG"

  consider "$cur_id" "$cur_until"
fi

if ((${#expired[@]})); then
  echo "bun audit: ${#expired[@]} exception(s) NO LONGER honoured — re-evaluate or renew:"
  printf '  - %s\n' "${expired[@]}"
fi

if ((${#ignores[@]})); then
  echo "bun audit: applying ${#ignores[@]} ignore(s) from osv-scanner.toml"
fi

exec bun audit --audit-level=high "${ignores[@]}"
