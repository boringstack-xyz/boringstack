# Dependency updates

Dependency updates land without a person. Nobody reviews or merges a
Dependabot PR by hand; merge-gate decides, as it does for every PR.

## How a bump lands

1. Dependabot checks every app, the GitHub Actions and the Docker images daily
   (`.github/dependabot.yml`). A version is only offered once it is seven days
   old (`cooldown`), so a broken or pulled release rarely reaches us.
2. `deps-automerge.yml` turns on auto-merge the moment the PR opens.
3. `merge-gate` runs every check the PR's diff touches. Green means merged.
4. `deps-steward.yml` runs every 15 minutes and after every push to main
   (`scripts/deps/steward.mjs`):
   - it turns on auto-merge for any Dependabot or `deps/*` PR that lacks it;
- it arms auto-merge again with the autofix token when the workflow token
  armed it, because a merge made with the workflow token starts no workflow on
  main (no steward run, no release);
   - it updates a PR that fell behind main, so the up-to-date rule never
     strands it;
   - it hands a Dependabot PR whose merge-gate failed to the dependency agent,
     once (label `deps-agent-tried`).
5. The dependency agent (Claude Code, in the same job) reads the failing
   checks and makes the update land: it adapts code, types, tests and
   lockfiles. It never weakens a check. If one package cannot land, it puts that
   package back, keeps the rest, and adds an `ignore` entry with the reason to
   `.github/dependabot.yml`. Its commit is created through the GitHub API, so it
   is signed as main requires, and goes through merge-gate like any other.
6. A PR that still fails gets the `deps-needs-person` label and one comment.
   That is the only case that reaches a person.

Advisories are handled the same way: `deps-autofix.yml` bumps each vulnerable
package to its minimal fixed version daily and opens an auto-merge PR on
`deps/autofix`.

## Switching it on

| Setting | Kind | What it enables |
| ------- | ---- | --------------- |
| `DEPS_AUTOFIX_ENABLED=true` | variable | the steward and the advisory autofix |
| `DEPS_AUTOFIX_TOKEN` | secret | a fine-grained token (Contents and Pull requests: write) so pushes start CI |
| `AGENTS_ENABLED=1` | variable | the dependency agent (and the other agent lanes) |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | the agent's Claude credential (`claude setup-token`) |

Without the agent settings, updates still auto-merge when green; a failing one
waits with its checks for a person.

## What the agent may not do

It may not touch `.github/workflows` or `.github/actions` (the job refuses to
push such a change), skip or delete tests, disable lint rules, lower
thresholds or raise size budgets. It gets one attempt per PR.
