# Test helpers

## `valkey.ts` — TCP probe + `requireValkey()` skip-guard

`isValkeyReachable()` opens a 500 ms TCP socket to the configured
`VALKEY_HOST:VALKEY_PORT` and caches the result. The probe is gated on
`RUN_VALKEY_NETWORK_TESTS=true`; unset, it returns false without
opening a socket.

`requireValkey()` wraps the probe with the same skip semantics as
`requireDb()`: returns true when Valkey is reachable; otherwise logs
a one-line skip notice and returns false. Set
`REQUIRE_INTEGRATION_VALKEY=true` to fail hard instead of skipping.

```ts
test("publishes to a channel", async () => {
  if (!(await requireValkey())) return;
  // ...real assertions
});
```

The global `afterAll` in `tests/setup-test-env.ts` calls
`closeValkeyHealthClient()` so individual tests don't have to remember
to dispose the module-scoped health-check client.

When you construct `ValkeyCacheService` in a test, do NOT combine
`lazyConnect: true` with `enableOfflineQueue: false` — the first command
fires before the connection is ready and ioredis errors with
"Stream isn't writeable and enableOfflineQueue options is false".
The TCP probe already gates whether the client is created, so the
default ioredis behaviour (eager connect, offline queue enabled) is
correct.

## `stripe-webhook-fixtures.ts`

Builders here round-trip through Stripe's `generateTestHeaderStringAsync`

- `constructEventAsync`, so the value returned IS a `Stripe.Event` with
  a real signed signature header. Always prefer these helpers; the
  signature/verify pair is the same code path production exercises.

If you hand-craft a webhook body (route-level tests via `app.handle()`),
every event needs a `created` field. See
`src/api/billing/CLAUDE.md` for why.

## `db.ts` — `requireDb()`

All integration-shape tests gate on `if (!(await requireDb())) return;`
so suites no-op when `DATABASE_URL` is unreachable. Even small-looking
tests in `tests/api/**` use the helper because their fixtures rely on
Drizzle and an actual schema.

## `auth.ts`

`seedVerifiedUser({ email })` creates a user, marks them verified, and
provisions a personal account + owner membership in one call. Tests
that need a logged-in caller should start here rather than building
ad-hoc inserts.
