#!/usr/bin/env bash
#
# Diff this repo's GitHub settings against the desired-state file. Prints
# fully copy-pasteable `gh api ...` commands for every drift. No auto-apply
# — the operator runs the printed commands. Exit 0 if clean, 1 if any drift.
#
# Required: gh (authenticated), jq.

set -euo pipefail

DESIRED=".github/desired-repo-settings.json"

if [[ ! -f "$DESIRED" ]]; then
  echo "Missing $DESIRED — run from the repo root." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "Required: gh + jq on PATH." >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Auditing $REPO against $DESIRED"
echo

DRIFT=0

note_drift() {
  DRIFT=1
  printf '  ⚠ drift: %s\n' "$1"
  printf '    fix:\n%s\n\n' "$2"
}

#
# --- Section 1: security_and_analysis (secret scanning + push protection +
#                Dependabot security updates)
#
SAA_CURRENT=$(gh api "repos/$REPO" --jq '.security_and_analysis')
SAA_DESIRED=$(jq -c '.security_and_analysis' "$DESIRED")

for key in secret_scanning secret_scanning_push_protection dependabot_security_updates; do
  want=$(echo "$SAA_DESIRED" | jq -r --arg k "$key" '.[$k] // "enabled"')
  have=$(echo "$SAA_CURRENT" | jq -r --arg k "$key" '.[$k].status // "disabled"')
  if [[ "$have" != "$want" ]]; then
    note_drift \
      "security_and_analysis.$key = $have (want $want)" \
      "      gh api -X PATCH repos/$REPO -f 'security_and_analysis[$key][status]=$want'"
  fi
done

#
# --- Section 2: merge settings
#
MERGE_CURRENT=$(gh api "repos/$REPO" --jq '{delete_branch_on_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge}')
MERGE_DESIRED=$(jq -c '.merge' "$DESIRED")

for key in delete_branch_on_merge allow_squash_merge allow_merge_commit allow_rebase_merge; do
  want=$(echo "$MERGE_DESIRED" | jq -r --arg k "$key" '.[$k]')
  have=$(echo "$MERGE_CURRENT" | jq -r --arg k "$key" '.[$k]')
  if [[ "$have" != "$want" ]]; then
    note_drift \
      "$key = $have (want $want)" \
      "      gh api -X PATCH repos/$REPO -F $key=$want"
  fi
done

#
# --- Section 3: branch protection on main
#
# All branch-protection fields except `required_signatures` are managed via
# a single PUT /branches/main/protection. We compute drift per field and, if
# any field drifts, emit ONE consolidated PUT command with the full body
# built from the desired JSON.
#
if PROT_CURRENT=$(gh api "repos/$REPO/branches/main/protection" 2>/dev/null); then
  :
else
  PROT_CURRENT='{}'
fi
PROT_DESIRED=$(jq -c '.branch_protection_main' "$DESIRED")

protection_drift=0
drift_summary=""

note_protection() {
  protection_drift=1
  drift_summary="${drift_summary}      - $1"$'\n'
}

# required_status_checks.contexts
want_contexts=$(echo "$PROT_DESIRED" | jq -c '.required_status_check_contexts | sort')
have_contexts=$(echo "$PROT_CURRENT" | jq -c '.required_status_checks.contexts // [] | sort')
[[ "$have_contexts" != "$want_contexts" ]] && \
  note_protection "required_status_checks.contexts = $have_contexts (want $want_contexts)"

# required_pull_request_reviews.required_approving_review_count
want_reviews=$(echo "$PROT_DESIRED" | jq -r '.required_approving_review_count')
have_reviews=$(echo "$PROT_CURRENT" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
[[ "$have_reviews" != "$want_reviews" ]] && \
  note_protection "required_approving_review_count = $have_reviews (want $want_reviews)"

# required_linear_history
want_lin=$(echo "$PROT_DESIRED" | jq -r '.required_linear_history')
have_lin=$(echo "$PROT_CURRENT" | jq -r '.required_linear_history.enabled // false')
[[ "$have_lin" != "$want_lin" ]] && \
  note_protection "required_linear_history = $have_lin (want $want_lin)"

# allow_force_pushes / allow_deletions
for key in allow_force_pushes allow_deletions; do
  want=$(echo "$PROT_DESIRED" | jq -r --arg k "$key" '.[$k]')
  have=$(echo "$PROT_CURRENT" | jq -r --arg k "$key" '.[$k].enabled // false')
  [[ "$have" != "$want" ]] && \
    note_protection "$key = $have (want $want)"
done

# Build the consolidated PUT body if any protection drift detected.
if [[ "$protection_drift" -eq 1 ]]; then
  # Translate desired JSON → PUT body. Reviews count 0 → null (no required reviews).
  rev_count=$(echo "$PROT_DESIRED" | jq -r '.required_approving_review_count')
  if [[ "$rev_count" -gt 0 ]]; then
    prr_block=$(jq -n --argjson n "$rev_count" \
      '{required_approving_review_count: $n, dismiss_stale_reviews: true, require_code_owner_reviews: false}')
  else
    prr_block='null'
  fi

  ctx_len=$(echo "$want_contexts" | jq 'length')
  if [[ "$ctx_len" -gt 0 ]]; then
    rsc_block=$(jq -n --argjson c "$want_contexts" '{strict: true, contexts: $c}')
  else
    rsc_block='null'
  fi

  put_body=$(jq -n \
    --argjson rsc "$rsc_block" \
    --argjson prr "$prr_block" \
    --argjson lin "$want_lin" \
    --argjson fp "$(echo "$PROT_DESIRED" | jq '.allow_force_pushes')" \
    --argjson del "$(echo "$PROT_DESIRED" | jq '.allow_deletions')" \
    '{
      required_status_checks: $rsc,
      enforce_admins: false,
      required_pull_request_reviews: $prr,
      restrictions: null,
      required_linear_history: $lin,
      allow_force_pushes: $fp,
      allow_deletions: $del,
      required_conversation_resolution: true
    }')

  fix_block="      gh api -X PUT \"repos/$REPO/branches/main/protection\" --input - <<'JSON'
${put_body}
JSON"

  note_drift "branch_protection.main" "$fix_block"

  if [[ "$ctx_len" -gt 0 ]]; then
    echo "    NOTE: required_status_checks.contexts will FAIL if those checks have"
    echo "          never run on main. Run each workflow once on main first (push a"
    echo "          trivial commit), or remove unrun contexts from the desired JSON."
    echo
  fi
fi

# required_signatures lives at its own endpoint (POST to enable, DELETE to disable)
want_sig=$(echo "$PROT_DESIRED" | jq -r '.required_signatures')
have_sig=$(echo "$PROT_CURRENT" | jq -r '.required_signatures.enabled // false')
if [[ "$have_sig" != "$want_sig" ]]; then
  if [[ "$want_sig" == "true" ]]; then
    note_drift \
      "required_signatures = $have_sig (want true)" \
      "      gh api -X POST \"repos/$REPO/branches/main/protection/required_signatures\""
  else
    note_drift \
      "required_signatures = $have_sig (want false)" \
      "      gh api -X DELETE \"repos/$REPO/branches/main/protection/required_signatures\""
  fi
fi

if [[ "$DRIFT" -eq 0 ]]; then
  echo "✓ All settings match $DESIRED."
  exit 0
fi

echo "Found drift. Apply the fix commands above, then re-run."
exit 1
