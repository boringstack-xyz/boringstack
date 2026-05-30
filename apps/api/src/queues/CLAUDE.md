# Queues — idempotency contract

Each queue has a different idempotency story. Mismatching it is how
duplicate emails go out and Stripe events double-charge.

## External-retry sources (must dedup before doing work)

**Stripe webhooks.** Stripe redelivers any failed webhook up to a few
times. `billing.service.handleWebhookEvent` is the only entrypoint.
First write inside every webhook handler is:

```ts
if (await this.ensureIdempotent(tx, event.id, event.type)) {
  return;
}
```

Backed by `stripeWebhookEvents` with `onConflictDoNothing` on
`stripe_event_id`. The handler bails before any UPDATE/INSERT against
`accountPlans`.

The stale-event guard runs second (see `src/api/billing/CLAUDE.md`):
`shouldSkipStaleStripeEvent` compares the incoming event's
`event.created * 1000` against the stored `lastStripeEventAt` snapshot
and no-ops when the incoming event is older.

## Internal BullMQ workers (idempotency is the _caller's_ job)

BullMQ retries failed jobs automatically (`attempts` + exponential
`backoffDelayMs` per queue's constants file). Retry is the _desired_
behaviour for transient failures and never duplicates a successful
job. But two distinct `queue.add()` calls with the same payload
produce two jobs and run twice — that's the caller's responsibility
to prevent.

### `email-delivery`

5 attempts, 5 s backoff, concurrency 5.

- A retry resends to the email provider. The provider (Resend,
  Cloudflare Email, SMTP) is at-least-once by design and the worker
  trusts it.
- The CALLER must not enqueue the same logical email twice. Auth
  flows enqueue once per credential mutation; if a caller hits the
  flow twice (double-click), the dedup must live at that call site,
  not here.
- For a dedup key, pass `jobId` to `queue.add(name, data, {
jobId: ... })`. Bull treats `jobId` as a uniqueness constraint; a
  second add with the same id no-ops.

### `notification-dispatch`

5 attempts, 5 s backoff. Fan-out worker — reads the event payload,
resolves the recipient's enabled channels, enqueues one downstream
job per channel.

- The dispatch job itself is idempotent: a replay re-runs the same
  fan-out and the downstream queues (`email-delivery`,
  `web-push-delivery`) provide their own retry envelopes.
- `notifications.deduplicationKey` on a published row dedups _user_
  notifications across the in-app channel. See
  `src/lib/notifications/dedup.service.ts`.

### `web-push-delivery`

3 attempts, idempotent at the protocol level — Web Push spec lets the
browser merge duplicate notifications with the same `tag`. The worker
deletes a subscription on `404 Gone` from the push service and emits
`notifications.web_push.subscription_expired`.

### `account-maintenance`, `notification-maintenance`

Cron-like sweeps. Idempotent by design — they UPDATE/DELETE rows that
match a stable predicate, so a missed run lands the same final state
the next time the cron fires. Comments inside the constants files
spell this out.

## When to add `Idempotency-Key` on HTTP routes

Reach for an explicit `Idempotency-Key` header + a dedup table only
for routes that:

1. Charge money, or
2. Are invoked by an external system with retry semantics.

User-facing mutations in this template rely on natural idempotency
(unique-token rows that get deleted in the same tx as the mutation,
filtered UPDATEs that update zero rows on replay, etc.). See
`apps/api/SECURITY.md` for the per-mutation list.
