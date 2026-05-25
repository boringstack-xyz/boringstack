# CI security gates

Read this when adding an allowlist entry, suppressing a finding, or
debugging a security workflow failure.

## Workflows

Three blocking workflows run on every push to `main`, every PR, and a
weekly cron (Monday 06:17–06:29 UTC). Findings upload as SARIF to the
repo's Security tab.

| Workflow           | What it catches                                      | Allowlist file         |
| ------------------ | ---------------------------------------------------- | ---------------------- |
| `security-secrets` | Leaked API keys, tokens, private keys (gitleaks CLI) | `.gitleaksignore`      |
| `security-deps`    | Known CVEs via `osv-scanner` + `pnpm audit`          | `osv-scanner.toml`     |
| `security-sast`    | OWASP / JS rule packs + custom rules in `.semgrep/`  | inline `// nosemgrep:` |

## Allowlist discipline

Every accepted-risk suppression carries a written reason and an
`ignoreUntil` date. When the date passes, the suppression dies and
CI fails — that's the point. No silent suppressions, no infinite
snoozing.

Example `osv-scanner.toml` entry:

```toml
[[IgnoredVulns]]
id = "GHSA-67mh-4wv8-2f99"
ignoreUntil = "2026-11-18T00:00:00Z"
reason = """
esbuild dev-server RCE. Production builds (vite build) don't run the
dev server. Awaiting upstream patch via vite transitive deps.
"""
```

Example inline Semgrep suppression — block comment for the reason,
single `//` for the directive:

```ts
/*
 * Sanitized server-rendered HTML, originates from our docs renderer.
 */
// nosemgrep: react.dangerously-set-inner-html
<div dangerouslySetInnerHTML={{ __html: sanitized }} />
```

## Repo settings drift detector

`scripts/ci/audit-repo-settings.sh` diffs
`.github/desired-repo-settings.json` against the live GitHub API and
prints copy-pasteable `gh api` commands. No auto-apply. Run it after
anyone touches repo settings in the UI.

Desired state on every repo:

- Secret scanning + push protection: on
- Dependabot security updates: on
- Merge style: squash-only, auto-delete branch
- `main`: signed commits, linear history, no force-push, no
  deletion, all status checks blocking

## Signed commits

`main` requires verified-signed commits. Configure your signing
setup before you push (1Password SSH agent works on macOS, or
GPG/SSH key with "Signing key" enabled in GitHub):

```sh
git config commit.gpgsign true
git config user.signingkey "<your key>"
```

Commits without a valid signature get rejected at push time.
