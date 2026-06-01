# Security

BoringStack is a template. Every fork inherits the defaults below and is
responsible for its own runtime security posture once cloned.

## Per-app policies

Each app has its own enforced security contract:

- [apps/api/SECURITY.md](apps/api/SECURITY.md) — JWT revocation, OAuth, rate
  limits, audit log, runtime hardening, production checklist.
- [apps/ui/SECURITY.md](apps/ui/SECURITY.md) — CSP, cookie posture, secret
  handling in the SPA build.

## Repo-level enforcement

The `main` branch on the BoringStack monorepo enforces:

- Signed commits
- Linear history (squash-merges only)
- All security workflows blocking on PR
- No force-push, no deletion

Three blocking workflows run on every push to `main`, every PR, and on a
weekly cron:

| Workflow | Scanner |
| --- | --- |
| `security-secrets` | gitleaks (pinned by SHA) |
| `security-deps` | `osv-scanner` + `bun audit --audit-level=high` |
| `security-sast` | Semgrep — OWASP + JS packs + `.semgrep/` rules |

Suppressions carry a written reason and an `ignoreUntil` date. The weekly
cron exists so expired suppressions surface even when no one pushes.

## Reporting a vulnerability

This repository is the public template. Vulnerabilities in code that lives
here can be reported via a private GitHub security advisory at
[github.com/boringstack-xyz/boringstack/security/advisories/new](https://github.com/boringstack-xyz/boringstack/security/advisories/new).

Do not open a public issue or PR for an unfixed vulnerability.

Forks running their own instance should replace this section with a
contact for their own deployment before going to production.
