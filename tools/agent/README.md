# Verified agent workflow

Use `bun run agent:inspect -- account-resource --json` before implementing an account-owned feature. It returns a bounded recipe whose paths and root commands are checked against this checkout. The API/UI contracts and existing lint rules remain authoritative.

## Code quality

Tooling follows the API's strict, type-aware script lint policy. `tools/eslint.config.mjs`
loads that policy directly; it does not maintain a weaker copy. Type assertions,
non-null assertions, unsafe JSON access and inline suppressions are rejected.
Identifiers and class spacing have explicit readability rules as well.

Run `bun run agent:quality` for typecheck, ESLint and formatting, or `bun run
agent:check` to include the tooling regression suite. Root `check` and structured
verification also run this quality gate. Use `bun run agent:format` to format tools,
metadata and template sources. Generated application code must still pass its
application's complete checks; template formatting is not a substitute.

The API generator templates live under `tools/agent/generate/templates`. The evaluator
separates API mutations, UI/browser acceptance and migrations into individual modules.

## Verification

Install the API and UI dependencies with their frozen lockfiles. Docker is required for integration profiles. Run from the repository root:

```sh
bun run agent:check
bun run sandbox:up -- --json
# Use the returned opaque ID, not ports copied from a developer .env:
bun run agent:verify -- --profile=feature --sandbox=<id> --json
bun run sandbox:down -- --id=<id>
```

| Profile         | Required evidence                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `openapi`       | Existing UI generator checks the caller-selected `OPENAPI_URL`; defaults to localhost:7330/swagger/json |
| `static`        | API/UI checks, ACL drift, scripts documentation, applicable docs data                                   |
| `feature`       | Static, migrations, templates, API integration tests, UI coverage tests, OpenAPI, Chromium acceptance   |
| `security`      | Migrations, templates, security tests and the existing per-case manifest reconciler                     |
| `release-local` | Feature + security + API coverage/build, UI build/bundle/modulepreload, applicable docs build           |

Exit codes are **0 passed, 1 failed, 2 blocked**. JSON stdout is one versioned object; progress goes to stderr. `not_applicable` is reserved for maintainer docs deliberately absent from downstream projects. A dead service, timeout, crashed fixture, missing/malformed report, skipped test or source edit during execution prevents a complete pass. Assertion failures remain failures. Profiles do not regenerate committed contracts or alter manifest expectations.

Results identify the Git commit and hash all tracked/untracked non-ignored files, modes and symlink targets before and after the run. Ignored configuration is not attested. `openapi` cannot establish a remote API's build provenance; the broader profiles start this checkout's private API/UI themselves. The before/after hash is not an adversarial tamper-proof boundary. Independent CI/review must retain its own verifier.

Local release evidence excludes GitHub-only CodeQL, dependency review, secret scans, action/permission checks and repository settings. It also does not establish production TLS/proxy behavior, external provider delivery, production capacity or disaster recovery. Read each check's status, not just the exit code of an unrelated legacy command.

## Owned infrastructure

Each `sandbox:up` creates pinned Postgres and Valkey containers with random loopback ports, random Postgres and Valkey credentials and checkout/run ownership labels. Credentials live only in a mode-0600 ignored descriptor under `.agent-state/sandboxes`; JSON output omits them. Verification ignores caller database URLs and uses the descriptor after checking ownership and live bindings. Database tests are destructive **inside that sandbox**.

Separate checkouts and sandboxes can run concurrently. Operations that generate/build/verify in the same checkout are serialized by a checkout lock, even with different sandbox IDs. A lease prevents overlapping verification suites on the same ID. `sandbox:down` refuses live leases, checks labels again, and removes only that run's containers and volumes. After an interrupted process exits, `sandbox:down -- --id=<id>` can reclaim its stale lease. It never globally prunes Docker or flushes a shared cache. If Docker cleanup fails, preserve the descriptor and retry the same ID.

The harness disables optional outbound providers and does not inherit developer secrets. This is development tooling for reviewed source, not a security sandbox for hostile code. API code still executes locally and can access local files/network. Do not execute an untrusted submission under credentials or mistake Docker data isolation for an OS sandbox.

## Account generator

```sh
bun run agent:resource Projects --scope=account --policy=team-read-admin-write --dry-run --json
bun run agent:resource Projects --scope=account --policy=team-read-admin-write --json
```

The new opt-in mode generates schema, relations, explicit owner/admin write and member/viewer read permissions, fresh-membership service authorization, tenant predicates, request ownership rejection, routes, audit events and real HTTP tests. It checks every patch target before writing and refuses ambiguous anchors, conflicts and symlink targets. Before writing, the account-resource CLI typechecks the full prospective API program using an in-memory overlay of the generated files and the real API tsconfig. Missing imports and semantic errors block both generation and dry runs without touching the checkout. Existing API type errors must also be fixed first. The full application check remains required for lint and other contracts. A generator lease coordinates simultaneous invocations, and each file is replaced atomically. On failure it restores its own unchanged writes; it preserves subsequent editor changes. If a process is killed during generation, inspect the diff for partial edits. `bun run agent:recover -- generator --acknowledge-partial-writes` and the equivalent `checkout` command remove only locks whose PID is dead; live or malformed locks are refused. Recovery never rolls back edits blindly. Review the dry-run path list. The legacy app-local user-scoped invocation remains available. Account generation is dispatched at the root; the API app does not import root tooling.

Generate SQL with the existing `db:generate` command; apply it through an owned verification sandbox. Run `bun run agent:sync -- --sandbox=<id> --json` from the root to apply the committed migrations, build test templates and regenerate ACL/OpenAPI through this checkout’s private runtime. This explicit write command reports the contract paths to review; verification itself remains read-only for committed contracts. The list has a deliberate 100-record bound; choose a pagination contract before growing it. Audit writes retain the stack's existing best-effort convention; this does not add a durable outbox. Naming supports simple plural PascalCase, not English inflection.

The checked example is under `tools/agent-evals/reference-ui`, not installed as an application feature. It demonstrates typed calls, account-specific query keys, create/rename invalidation, role-aware UI, loading/error/empty states and both locales. Its single projects→auth lint allowance follows the existing canonical `useMe` pattern; no general cross-feature exemption is added to the starter.

## Independent acceptance

```sh
bun run agent:check:docker
bun run agent:eval --deterministic
```

The deterministic evaluator creates a docs-free copy, generates Projects, starts isolated services, installs acceptance tests from the reviewing checkout, and exercises known-good behavior plus deliberate missing-scope, missing-role, stale-cache and missing-migration mutations. It also applies a description migration over an existing row and runs the Projects browser scenario. Candidate test files and self-reported results are not used as the judge.

Task prompts for Projects, a description migration, and a tenant fix are in `tools/agent-evals/tasks`. These are evaluation tasks, not a benchmark claim. Deterministic fixture/mutant runs measure the judge; they are not live model runs. No provider account, model selection or spending is implicit. Record model/version, prompt, patch, verifier revision, intervention count and full outcomes for each live run. The planned two-configurations × three-tasks × three-repeats comparison remains a release measurement requiring selected agent configurations.

## Maintenance

`agent:check` covers protocol failures, real OpenAPI generation, subprocess deadlines, recipe drift, patch conflicts and repeat generation. `agent:check:docker` proves isolation and scoped cleanup. The always-reporting PR workflow runs tooling tests and deterministic integration checks when relevant paths change. Existing API/UI/security gates remain separate.

`bun run check` returns 2 (incomplete) when required OpenAPI verification is unavailable, 1 when a check fails, and 0 only when all checks in its declared scope complete. Start the API or set `OPENAPI_URL` before rerunning. It still cannot substitute for `agent:verify --profile=release-local` or the complete GitHub checks.

To review an independently implemented Projects checkout, run `bun run agent:eval -- --candidate=/absolute/path/to/checkout`. The reviewer copies only the declared production integration files and appended Drizzle artifacts into its own fixture. Existing migration history must match. Candidate tests, scripts, CI and evaluator files are excluded; candidate files must be regular files within that checkout. Candidate mode does not generate missing SQL for the submission. Dependencies are copied into each fixture (copy-on-write where supported), not symlinked into the reviewer checkout. Evidence is written to a separate private temporary directory. Candidate execution runs in a non-root Docker container with a read-only root, no host mounts, no Docker socket, no inherited host credentials and no external network. Disposable Postgres and Valkey share only its loopback network namespace. CPU, memory, process and temporary-storage limits apply. Image preparation installs the reviewer’s locked dependencies before any candidate source enters the runtime. The controller removes its containers and image tag after completion or failure. Container isolation protects the host; it does not make a same-process test runner tamper-proof against application code. Review the candidate and evidence independently. Candidate mode runs acceptance against arbitrary implementations, while the separate deterministic run validates the judge against deliberate defects. It runs the same named API/UI/browser acceptance and generated-checkout API/UI static checks; the broader security and release profiles remain required separately. Alternate resource names and arbitrary task schemas are not accepted by this first concrete judge.

The desired repository settings list `agent verification contract` as required. This change does not apply GitHub settings remotely; let the new workflow report before reconciling those settings.

## Updating the expected test inventory

Ordinary API, UI and browser lanes compare every observed case identity, including
multiplicity, against `tools/agent/inventories/*.json`. Missing, substituted and
unexpected cases block verification. This deliberately requires review when tests
are added or removed, including generated feature tests.

Run the feature profile first. A complete passing underlying suite writes a private
observation even if its inventory disagrees. Then explicitly run:

```sh
bun run agent:inventory -- api.tests ui.tests ui.e2e
```

This first command is a preview: it prints exact added/removed identities and a
review token without updating files. Approve the same diff explicitly:

```sh
bun run agent:inventory -- api.tests ui.tests ui.e2e --accept=<token>
```

If any cases are removed (including one occurrence of a duplicate or a same-count
replacement), also supply `--allow-removals=<token>`. This acknowledges the exact
removals already displayed; it is not a blanket permission for future reductions.
The token binds the checkout, old baseline and fresh observation. Any change
invalidates approval. Choose only changed lanes, approve them together, review the
committed diff, then rerun verification. Approval never declares the update verified.

Owned browser invocations disable retries. A retry attachment is blocked if fed
back as evidence. Coverage/forbidden-warning gate failures are reported as failures
when the complete test inventory agrees; missing or crashed execution stays blocked.

The owned API uses Bun; the owned Vite server uses Node, matching Vite’s CLI runtime. Install Node compatible with the UI package’s engine requirements alongside Bun. Both servers bind to IPv4 loopback, and readiness checks report transport/HTTP failures separately from process exits.
