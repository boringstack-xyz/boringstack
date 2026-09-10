# security-spec

An executable specification for the findings of the 2026-09-09 API security
review (reviewed commit `84acce84`).

**All 22 findings are fixed and this suite is green.** Every test asserts the
behaviour a finding said was missing, so it is now the regression net for all
of them: it goes red the moment one comes back. It gates on CI.

It was written expected-red, against the unfixed code, and the tests were not
edited to make them pass — that is the property that makes a green run mean
something. Anything asserted here was observed failing first.

## Running it

Postgres and Valkey both have to be up, and the suite refuses to run without
them — see "Why it fails instead of skipping" below.

```bash
cd apps/api

# Dedicated disposable instances. Do NOT point these at a database you care
# about: the suite truncates tables between tests and deletes MFA challenge
# keys from Valkey.
docker run -d --name bs-spec-pg -p 55432:5432 \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=spec_pw -e POSTGRES_DB=app \
  postgres:17-alpine
docker run -d --name bs-spec-valkey -p 56379:6379 valkey/valkey:8-alpine

export SPEC_DB="postgresql://app:spec_pw@127.0.0.1:55432/app"

# DATABASE_URL, not TEST_DATABASE_URL: drizzle.config.ts calls dotenv.config()
# and reads DATABASE_URL, so passing only TEST_DATABASE_URL migrates whatever
# your .env points at — which may be a live tunnel — and leaves the throwaway
# database empty.
DATABASE_URL="$SPEC_DB" bun run db:migrate

DATABASE_URL="$SPEC_DB" \
TEST_DATABASE_URL="$SPEC_DB" \
REQUIRE_INTEGRATION_DB=true \
RUN_VALKEY_NETWORK_TESTS=true \
VALKEY_HOST=127.0.0.1 VALKEY_PORT=56379 \
CACHE_PROVIDER=valkey CACHE_ENABLED=true \
GOOGLE_OAUTH_CLIENT_ID=spec-google-client-id \
GOOGLE_OAUTH_CLIENT_SECRET=spec-google-client-secret \
ACCOUNT_DOMAIN_CLAIMING=true \
EMAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 \
  bun run test:security
```

Both commands must name the same disposable database. `DATABASE_URL` drives
migration and the F12 lock schedule, `TEST_DATABASE_URL` drives the test
preload; setting only one points them at different targets.

`.github/workflows/apps-api-security-spec.yml` sets the same variables against
service containers.

### Why those variables

Four of them exist because the finding is otherwise invisible, which is the
failure mode this suite is built to avoid:

| Variable                        | Without it                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CACHE_PROVIDER=valkey`         | `setup-test-env.ts` pins the memory cache, where each rate limiter gets its own LRU. F15's shared-key collision cannot occur, and F04's MFA challenge never reaches Valkey. |
| `RUN_VALKEY_NETWORK_TESTS=true` | The Valkey helper reports "unreachable" regardless of whether Valkey is up.                                                                                                 |
| `ACCOUNT_DOMAIN_CLAIMING=true`  | `resolveDomainClaim` returns early and F11's branch never runs; signup just provisions a new account.                                                                       |
| `GOOGLE_OAUTH_*`                | F02 fails on a missing-credentials `NOT_FOUND` before reaching its assertion.                                                                                               |

`SECURITY_SPEC=true` is set by the `test:security` script and is what unlocks
the first and third of those in `tests/setup-test-env.ts`.

It also **pins** `RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_MAX` for this lane, and
that one is load-bearing. The preload defaults them with `??=`, which loses to
`.env` (`RATE_LIMIT_MAX=100`). Harmless under the memory provider, where each
limiter has its own LRU — but this lane runs on Valkey, and F15 is the finding
that every limiter writes the same `rl:<ip>` key. Under `app.handle` there is
no client address, so the whole suite shares one counter whose 60-second TTL
outlives the process. Past 100 requests, unrelated files start seeing 429 on
login and their positive controls fail, and whether that happens depends on
how recently the suite last ran. That is how a stable-looking baseline turns
out to have been stable only for the runs that were measured.

## Why it fails instead of skipping

`tests/helpers/db.ts` documents that integration tests "bail silently when no
Postgres is reachable". That is right for the main suite and wrong here: a test
that bails is a test that passes, and every test in this directory is supposed
to fail. A green run would then mean the opposite of what it appears to.

So `harness.ts` throws where the normal helpers return `false`. For scale, the
main suite has 440 silent-bail sites across 49 of its 160 files.

## The manifest

`findings.json` lists every finding with a `status` and, more importantly, the
expected outcome of **every named case**:

```json
{
  "id": "F09c",
  "status": "proven",
  "file": "f09c-feature-and-seat-enforcement.test.ts",
  "cases": {
    "inviting is refused when the plan withholds can_invite_team": "assertion-fail",
    "accepting an invitation cannot take the account past max_seats": "assertion-fail",
    "control: inviting succeeds when the plan grants it": "pass"
  }
}
```

Per-case rather than per-finding, because counts alone let a partial change
through: a finding needed only one non-control assertion failure to reconcile,
so a second case could be fixed — or could quietly stop exercising its
condition — and nothing noticed.

`bun run check:security-manifest` reconciles this against a real run and fails
on any drift in either direction: a case that changed outcome, one that did not
run, one that ran without being listed, a duplicate name, a skip, a failing
control, or a failure that was a thrown fixture error rather than an assertion.

`bun run write:security-manifest` regenerates the expectations from a run.
Read the diff — that diff is the signal.

## Workflow

Adding a finding: `bun run new:finding -- F23 high "<what must hold>"`. It
scaffolds the spec file and its manifest row, and the scaffold fails as
infrastructure until you write it, so an abandoned one cannot be mistaken for
evidence.

Reopening a finding — a regression, or a fix that turns out to be partial:

1. Set its `status` back to `"proven"`.
2. `bun run write:security-manifest` to record the failing cases.
3. Review the diff. Every case that changed should be one you meant to change.

Fixing it again reverses those steps. The manifest is the record of what is
currently true, and `check:security-manifest` fails on drift in either
direction.

## Notes on individual findings

- **F01c** — the review identified the inconsistency; the direction is the
  part that decides the test. `readBoolean` is strict, so the missing
  `email_verified` yields `false` and GitHub signup fails **closed** for
  public-email users. The test asserts that availability bug, not a takeover.
  Google and LinkedIn read genuine OIDC `email_verified`, which is why F01a
  uses `"google"`.
- **F03** — the pre-existing test at `tests/middleware/body-limit.test.ts:88`
  sends malformed JSON, so the parser returns 400 (`code: "PARSE"`) and the cap
  never fires. Replace it rather than extend it.
- **F09a** — asserted against `unpaid`, matching the review's own probe.
  `canceled` is swept hourly by `account-maintenance.jobs.ts`, so a test
  written against it would assert a self-resolving condition.
- **F10** — the deletion path keeps the row and its subscription id and only
  flips `status`, so the assertion is on status. Checking the id alone passes
  against the defect. The fixture must also seed a plan whose `stripePriceId`
  matches the event, or reconciliation returns early and every assertion is
  made against an empty table.
- **F11 / F12** — `seedVerifiedUser` calls `provisionAfterVerification`, so
  with domain claiming enabled a second user on a claimed domain throws during
  setup. F11 seeds its joining user unprovisioned; F12 uses public email
  domains so claiming never engages.
- **F12** — the ownerless-account defect needs the revocation to land between
  accept's read and its write, which scheduling alone does not arrange. The
  test imposes that order with a `SELECT ... FOR UPDATE` held on a second
  connection. The invitation TOCTOU is **not** claimed: it is correctly
  refused under serial execution and did not reproduce deterministically.
- **F02 / F07** — both drive the real OAuth callback with the provider
  exchange stubbed (`fixtures/oauth-flow.ts`) and assert on whether a session
  cookie is issued. Status codes are not asserted: mapping a provider failure
  to 400 would satisfy a status check without establishing any binding.
- **F09b / F09c** — behavioural. An earlier version searched `src` for helper
  and feature names, which meant three TODO comments containing those names
  turned every case green while the operations stayed unguarded. F09c drives
  the invitation route over HTTP against real plan state; F09b resolves
  features across expiry boundaries. A fix through a differently named helper
  passes; a comment does not.
- **F09c seats** — asserted on committed active memberships, never on
  invitation creation. Creation-only was both too weak (a 500 or an unrelated
  429 satisfied "status >= 400") and too strong (it ruled out enforcing at
  acceptance, which is a correct design). Every seat case drives a real
  seat-consuming operation — invitation acceptance and join-request approval,
  which are separate write paths into `account_memberships` — and covers the
  race for the last seat and an invitation outstanding across a downgrade.
- **F09c fixtures** — outstanding invitations are written directly, not
  through `invitationsService.create`. Going through the service was justified
  earlier as bypassing the route gate, which was wrong: enforcing quota inside
  the service is a good implementation, and under it the fixture would throw
  at capacity and the acceptance case would never reach the operation it
  exists to test. An invitation can be outstanding for reasons that predate
  any check — issued before a downgrade, before a member joined, under an
  older policy — and the cap has to hold for all of them. Creation policy has
  its own cases.
- **F09c refusals** — `rejectInfrastructure` raises 429, 401, 404 and 5xx as
  infrastructure. A seat assertion is trivially satisfied by an operation that
  never ran, so an approval route that 404s would otherwise read as a passing
  cap check. 403 stays allowed, since the owner does hold the role and a
  forbidden is a plausible quota shape; each operation has its own
  allowed-path control to rule out a route that refuses everything.
- **F10 ordering** — both delivery orders are specified with identical
  `created` seconds, plus a delayed checkout. Forward convergence already
  passes and is recorded as such; it is **not** evidence of order
  independence. Reverse is the destructive direction: checkout revokes the
  current plan and writes a row with no subscription id and no period, so
  arriving second it discards what the subscription event established. A fix
  that merely retains the checkout's subscription id turns the forward cases
  green while the reverse still erases the period.
- **F11 errors** — the joining operation accepts `DOMAIN_CLAIMED` by code and
  the typed success outcome, and **rethrows everything else**. An earlier
  `.catch(() => undefined)` discarded every error, so an unrelated database
  failure produced the same pending-row assertion failure as the finding and
  the real cause never reached the report. A rethrow surfaces as a thrown
  fixture error, which the reconciler rejects as evidence.
- **F16** — asserted at the service boundary, not the TypeBox schema, because
  validating a destination wants DNS and egress policy and cannot be
  synchronous. No outbound request is made.
- **F13** — asserted in a child process against the real handler's
  `unhandled_rejection` log marker. Bun intercepts unhandled rejections in the
  runner, and production mode forces TLS on the Postgres client, which neither
  the local throwaway database nor the CI service container provides. The
  `process.exit(1)` is one branch after the marker.

## What is not covered

Named so nobody reads a red suite as a complete map of the findings:

- F05 covers the boot-configuration combination, not durable revocation
  behaviour during a live cache outage.
- F13 covers process death only. The outbox, dedup and audit-durability
  sub-findings have no test.
- F14 covers stream lifetime, not connection budgets or subscriber leaks.
- F18 covers exception expiry, not the wider integration-assurance scope.
- F16 covers registration only. Delivery-time behaviour — DNS rebinding
  between validation and send, and the missing request deadline — needs tests
  at the worker boundary.
- F07 does not assert that an OAuth-only user can enrol a factor. They cannot
  today (`mfa.service.ts:475-508` fails closed without a password), which is
  what makes the F01b attack undefendable, but a safe fix may require a
  provider step-up flow that does not exist yet and any assertion now would
  dictate that design.
- F12 does not claim the invitation-token TOCTOU. It is correctly refused
  under serial execution and did not reproduce deterministically.
- F09c does not specify seat **reservation**. If the product decides a pending
  invitation should hold a seat, that is an additional guarantee — reserve on
  issue, release on revoke or expiry — and needs its own cases. The cases here
  only require that committed memberships never exceed the cap.
- F09c's concurrent case is a probe, not a proof. Today nothing counts seats,
  so all four claimants commit and it fails on real over-subscription. Against
  a fixed implementation `Promise.all` only starts four requests — it does not
  guarantee all four read capacity before any writes, so a count-then-insert
  with no advisory lock can survive a lucky run. Closing that needs an
  imposed schedule the way F12 does, which cannot be written until there is an
  implementation to interleave with. A green run here is not evidence the fix
  is race-free.
- F09c does not test creation-time entitlement beyond `can_invite_team`.
  Whether creation should also refuse at capacity is a policy question; the
  fixtures are built so that answering it either way leaves these cases
  intact.
- F13 still includes one source scan alongside its behavioural test. That one
  is supporting evidence, not closure.
