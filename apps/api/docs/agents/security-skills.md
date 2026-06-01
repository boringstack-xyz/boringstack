# Security skill set

Read when running a security review of a diff, a file, or a running
instance.

This repo ships `.claude/settings.json` declaring two plugin
marketplaces. When you trust the folder, Claude Code prompts to
install:

- **Trail of Bits** (`trailofbits/skills`): `differential-review`,
  `insecure-defaults`, `static-analysis`, `supply-chain-risk-auditor`,
  `fp-check`, `sharp-edges`
- **Ghost Security** (`ghostsecurity/skills`): `ghost-validate`,
  `ghost-scan-code`

## When to invoke which

| Situation | Skill |
| --- | --- |
| Reviewing a PR diff for security regressions | `/differential-review` |
| "Did we leave any footguns in this file?" | `/sharp-edges <path>` |
| New dep added — is the dep tree healthy? | `/supply-chain-risk-auditor` |
| Reviewing config / env handling | `/insecure-defaults` |
| Running CodeQL / Semgrep ad-hoc on a branch | `/static-analysis` |
| Validating a finding from another skill | `/fp-check` |
| Probing a *running* api for live vulnerabilities (DAST) | `/ghost-validate` |
| AI-driven SAST sweep over the diff | `/ghost-scan-code` |

## Full BoringStack review

For the stack-specific sweep (ACL coverage, Stripe webhook integrity,
multi-tenant `accountId` scoping, rate limits on credential routes,
audit-log on mutations, idempotent BullMQ jobs):

```
/security-review
```

That skill is project-owned at `.claude/skills/security-review.md` and
orchestrates the agent skills above plus stack-specific invariants.

Marketplaces are an external dependency. To opt out, delete the
`extraKnownMarketplaces` block from `.claude/settings.json`.
