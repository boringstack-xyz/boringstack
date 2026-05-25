# CI security gates

Read this when adding an allowlist entry, suppressing a finding, or
debugging a security workflow failure.

## Workflows

Three blocking workflows run on every push to `main`, every PR, and a
weekly cron (Monday 06:17–06:29 UTC). Findings upload as SARIF to the
repo's Security tab.

| Workflow | What it catches | Allowlist file |
| --- | --- | --- |
| `security-secrets` | Leaked API keys, tokens, private keys (gitleaks CLI) | `.gitleaksignore` |
| `security-deps` | Known CVEs in deps via `osv-scanner` + `bun audit` | `osv-scanner.toml` |
| `security-sast` | OWASP / JS rule packs + custom rules in `.semgrep/` | inline `// nosemgrep:` |

## Allowlist discipline

Every accepted-risk suppression carries a written reason and an
`ignoreUntil` date. When the date passes, the suppression dies and CI
fails — that's the point. No silent suppressions, no infinite snoozing.

Example `osv-scanner.toml` entry:

```toml
[[IgnoredVulns]]
id = "GHSA-67mh-4wv8-2f99"
ignoreUntil = "2026-11-18T00:00:00Z"
reason = """
esbuild dev-server RCE. Production builds don't run the esbuild dev
server. Awaiting upstream patch via vite transitive deps.
"""
```

Example inline Semgrep suppression — block comment for the reason,
single `//` for the directive (multiline-comment-style would otherwise
fail):

```ts
/*
 * `precompiledCode` is the JSON output of Handlebars.precompile() over
 * template files we own. Never user input, never network-reachable.
 */
// nosemgrep: semgrep.no-eval
const spec: unknown = new Function("return " + precompiledCode)();
```

## Repo settings drift detector

The monorepo root `./scripts/audit-repo-settings.sh` reads
`.github/desired-repo-settings.json`, diffs against the live GitHub API,
and prints copy-pasteable `gh api` commands for any drift. It auto-applies
nothing. Run it after anyone touches repo settings in the GitHub UI.

Desired state (enforced on every repo):

- Secret scanning + push protection: on
- Dependabot security updates: on
- Merge style: squash-only, auto-delete branch
- `main`: signed commits required, linear history, no force-push, no
  deletion, all four status checks blocking, conversations must resolve

## Signed commits

`main` requires verified-signed commits. Configure your signing setup
before you push — 1Password SSH agent + `gpg.ssh.program` works on
macOS, or a standard GPG/SSH key registered in GitHub Settings → SSH
and GPG keys (with "Signing key" enabled).

```sh
git config commit.gpgsign true
git config user.signingkey "<your key>"
```

Commits without a valid signature get rejected when pushed.
