#!/usr/bin/env bash
#
# Resolves the registry digest for every `image: <ref>` line under compose/
# and prints a patched version with `@sha256:<digest>` appended. The output
# is a unified diff against the working tree.
#
# Usage:
#   scripts/pin-image-digests.sh           # dry run, prints diff
#   scripts/pin-image-digests.sh --apply   # rewrites compose/*.yml in place
#
# Skips:
#   - Lines that already contain `@sha256:` (already pinned).
#   - Lines that look like `${...}` interpolations (operator-controlled).
#
# Required on PATH: curl, jq.

set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

if ! command -v curl >/dev/null || ! command -v jq >/dev/null; then
  echo "Required: curl + jq on PATH." >&2
  exit 1
fi

# Fetch the registry digest for image:tag using the v2 distribution API.
# Handles Docker Hub naming (single-name → library/<name>).
fetch_digest() {
  local image_ref=$1
  local repo=${image_ref%:*}
  local tag=${image_ref#*:}

  if [[ "$repo" != */* ]]; then
    repo="library/$repo"
  fi

  local token
  token=$(curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull" 2>/dev/null | jq -r .token)

  curl -fsSL -I \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json" \
    "https://registry-1.docker.io/v2/${repo}/manifests/${tag}" 2>/dev/null \
  | tr -d '\r' \
  | awk 'BEGIN{IGNORECASE=1} /^docker-content-digest:/ {print $2; exit}'
}

cd "$(dirname "$0")/.."

PATCH_DIR=$(mktemp -d)
trap 'rm -rf "$PATCH_DIR"' EXIT

ANY_CHANGES=0

for file in compose/*.yml; do
  patched="${PATCH_DIR}/$(basename "$file")"
  cp "$file" "$patched"

  while IFS= read -r line; do
    # Capture the image reference. Skip variable interpolations + already-pinned.
    if [[ "$line" =~ ^[[:space:]]+image:[[:space:]]+([^[:space:]\$]+)[[:space:]]*$ ]]; then
      ref="${BASH_REMATCH[1]}"

      if [[ "$ref" == *"@sha256:"* ]]; then
        continue
      fi
      if [[ "$ref" != *:* ]]; then
        echo "  skip (no tag): $ref" >&2
        continue
      fi

      printf "  resolving %s ... " "$ref" >&2
      digest=$(fetch_digest "$ref")
      if [[ -z "$digest" || "$digest" != sha256:* ]]; then
        echo "FAILED" >&2
        continue
      fi
      echo "$digest" >&2

      # In-place replace the bare ref with ref@digest.
      # Use a tab-delimited sed so '/' in repo names doesn't break.
      sed -i.bak "s|image: ${ref}\$|image: ${ref}@${digest}|" "$patched"
      rm -f "${patched}.bak"
      ANY_CHANGES=1
    fi
  done < "$file"

  if ! diff -q "$file" "$patched" >/dev/null; then
    if [[ "$APPLY" -eq 1 ]]; then
      cp "$patched" "$file"
      echo "✓ patched $file"
    else
      diff -u "$file" "$patched" || true
    fi
  fi
done

if [[ "$ANY_CHANGES" -eq 0 ]]; then
  echo "All compose images already digest-pinned. ✓"
fi
