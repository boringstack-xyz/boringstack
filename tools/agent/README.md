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

Within one run, verification schedules ready checks against a shared CPU-slot budget. API/UI/tooling checks run their constituent scripts independently; contract tests keep them aligned with each app's complete `check` command. Builds start early, size checks wait for a successful UI build without occupying slots, and static checks overlap sandbox preparation. Failed prerequisites block their dependents while independent checks finish.

Local defaults reserve two host cores and budget roughly 2 GiB per slot, capped at 24 slots. A 16-core, 64-GiB host gets 14 slots, with four workers each for Playwright and Vitest; each pool consumes four slots from that same budget. Real CI defaults to at most four slots and one worker per test pool. The runner captures the caller's CI setting before assigning `CI=true` to isolated child processes, so local browser tests can run in parallel while retaining CI safety checks and zero retries.

| Override                      | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `AGENT_VERIFY_PARALLEL=8`     | Set the shared CPU-slot budget.                                     |
| `AGENT_VERIFY_TEST_WORKERS=2` | Set workers per Playwright/Vitest pool, bounded by the slot budget. |
| `AGENT_VERIFY_PARALLEL=1`     | Run one task and one test worker at a time.                         |

The two API suites are the longest single processes of a run, so locally both are sharded the same way. Coverage in `release-local` comes from the shards' LCOV reports: line coverage merges exactly (a line hit in any shard is covered), function coverage can only be combined as the best shard per file because Bun's LCOV carries no per-function records, so when that lower bound alone misses the floor the whole suite runs once through `check-coverage.ts` and its verdict decides. The security spec in detail: its files are packed largest-first into as many shards as there are browser workers (four on a large host), each shard runs on its own database and Valkey index (`app_security_1` to `app_security_4`), and an aggregate task merges the JUnit reports so the evidence and the findings manifest read one run. With one worker (CI) the spec runs whole on `app_security` exactly as before. The Vitest pool for UI tests grows to half the slot budget, capped at eight, since it becomes the long pole once the spec is sharded; `AGENT_VERIFY_TEST_WORKERS` pins both pools.

Stateful lanes own separate Postgres databases and Valkey indexes inside the sandbox: `app_tests`, `app_security` (or its shards), and `app_e2e`. Only the selected profile's databases are prepared. `release-local` runs the API suite once with coverage; the same execution provides JUnit inventory evidence and enforces the coverage and warning gates. Email templates are prepared before readers start, and subsequent builds leave identical artifacts untouched.

Agent verification emits a coverage summary and `lcov.info`, without generating HTML pages; Vitest still enforces every configured coverage threshold. Standalone `test:ci` retains its configured reporters. Bundle budgets retain their exact gzip byte limits and set `running: false` to avoid unbudgeted headless-Chrome execution measurements; generated translation budgets use the same setting.

Typechecking stores incremental project information in ignored `node_modules/.cache/tsc` files, with separate files for API, UI, and tooling. TypeScript still checks affected dependents after edits. Generated-code validation uses a fresh in-memory program. Deleting the cache forces a cold typecheck; no verification pass is reused or inferred from a cache.

JSON results retain a fixed check order and add `execution` with the selected budget and each task's `startedAfterMs`, `durationMs`, and status. Start offsets include dependency and capacity waiting, making it possible to distinguish a late start from slow execution. UI test, browser, and runtime startup durations are included in check results. Sandbox startup (`sandbox:up`) is outside verification timing; reuse an owned sandbox across iterations and remove it when the task is finished.

The automatic budget assumes this verification is the main workload. On a busy host or when several checkouts verify simultaneously, lower `AGENT_VERIFY_PARALLEL` to share resources; memory pressure can slow down every lane and trigger test deadlines. Failed commands retain private diagnostic logs under ignored `.agent-state/verification`, and failed browser runs retain a private `.agent-state/playwright-*.xml.log`.

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
multiplicity, against `tools/agent/inventories/*.json`. The protocol:

- **Additions are recorded automatically.** When a lane's observation is the baseline
  plus new cases and nothing is removed, the feature verification run rewrites that
  lane's baseline after the checkout is confirmed unchanged. The lane reports
  `test_inventory_additions_recorded`. Commit the updated `tools/agent/inventories/*.json`
  with the feature change; no separate accept step is needed.
- **Removals block and are never recorded.** A removed, renamed or same-count
  substituted case (including one fewer occurrence of a duplicate) fails the lane with
  `test_inventory_disagrees`. The failure output lists each removed identity and prints
  one command. Run it, then rerun verification:

  ```sh
  bun run agent:inventory -- api.tests --accept=<token> --allow-removals=<token>
  ```

  The token binds the checkout, the old baseline and the fresh observation, so any
  source or test change invalidates it. Review the printed identities before running it.
  Acknowledgement only updates the baseline; it does not declare the run verified.

- **Zero observed cases block** with `test_inventory_empty`; they are never recorded
  and cannot be acknowledged. Fix the lane so it runs its tests.
- **Preview** is still available and writes nothing:
  `bun run agent:inventory -- api.tests ui.tests ui.e2e`.

A run writes baselines only when no lane has removals, and only from observations
bound to the run's own fingerprint. The run's reported checkout fingerprint describes
the tree before that write, so review the inventory diff as part of the feature diff.

Limitation: CI does not compare observed cases with the committed inventories. See
"CI enforcement" below.

### CI enforcement

CI does not enforce that the committed inventories match what a run observed.
Verified facts:

- `.github/workflows/agent-verification.yml` runs `agent:check`, `agent:check:docker`
  and `agent:eval --deterministic`. None of these runs the API, UI or browser lanes, so
  no JUnit report and no observation is produced there.
- `apps-api-ci.yml` runs `bun run test` against Postgres, and the UI workflows run their
  own test scripts. None writes JUnit or reads `tools/agent/inventories`.
- Running the `feature` profile in CI would need the owned Docker sandbox, migrations,
  Chromium and every suite. That is not cheap, so it was not added.

What CI does enforce: `agent:check` asserts that each committed baseline parses and is
non-empty. That catches an emptied or deleted baseline. It does not catch a removed test
whose baseline was left stale, or a feature change merged without running feature
verification. Closing that gap needs a CI job that runs the feature profile, or a JUnit
comparison in the API workflow.

Owned browser invocations disable retries. A retry attachment is blocked if fed
back as evidence. Coverage/forbidden-warning gate failures are reported as failures
when the complete test inventory agrees; missing or crashed execution stays blocked.

The owned API uses Bun; the owned Vite server uses Node, matching Vite’s CLI runtime. Install Node compatible with the UI package’s engine requirements alongside Bun. Both servers bind to IPv4 loopback, and readiness checks report transport/HTTP failures separately from process exits.

### Interrupted verification leases

A `lease_locked` blocker identifies a sandbox already reserved by a verification
process. Inspect the owner and wait for a live process. After an interrupted owner
has exited, run:

```sh
bun run agent:recover -- lease --id=<sandbox-id> --acknowledge-partial-writes
```

Recovery refuses live or malformed owners and validates the sandbox belongs to
this checkout. Inspect any partially written test data, then rerun verification;
recovering the lease is not evidence the interrupted run passed.
