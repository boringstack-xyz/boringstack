# Billing + Stripe webhooks

## Out-of-order webhook protection

Stripe redelivers may arrive in any order. Every mutating webhook
handler (`handleCheckoutSessionCompleted`, `handleSubscriptionUpsert`,
`handleSubscriptionDeleted`) MUST call:

```ts
if (await this.shouldSkipStaleStripeEvent(tx, accountId, details)) {
  return;
}
```

…before any UPDATE/INSERT against `accountPlans`. The guard compares
`Date.parse(current.lastStripeEventAt)` against `event.created * 1000`
and silently no-ops if the inbound event is older than the snapshot.

On a successful mutation, write the snapshot back:

```ts
lastStripeEventId: details.eventId,
lastStripeEventAt: stripeEventOccurredAt(details.eventCreated),
```

## Webhook idempotency

`ensureIdempotent(tx, eventId, eventType)` inserts into
`stripeWebhookEvents` with `onConflictDoNothing` at the start of
`handleWebhookEvent`. If the returning row is empty, the event was
already processed — bail out before any handler runs.

## Test fixtures

`tests/helpers/stripe-webhook-fixtures.ts` round-trips through Stripe's
own `generateTestHeaderStringAsync` + `constructEventAsync`, returning a
real `Stripe.Event` with a real signed header. Prefer these helpers.

When you hand-craft a webhook body (e.g. for `app.handle()` route
tests), `created` is required:

```ts
const body = JSON.stringify({
  id: "evt_test",
  type: "checkout.session.completed",
  created: Math.floor(Date.now() / 1000),
  data: { object: { ... } },
});
```

Missing `created` makes `stripeEventOccurredAt(undefined)` produce
`new Date(NaN).toISOString()`, which throws RangeError "Invalid Date".
Routes surface that as a generic 500.

## `resolveBillingAccount(userId, accountId)`

Routes pass BOTH the user id AND the active account id from auth
context. Resolving "the first owner membership" is wrong — owners of
multiple accounts would bill the wrong tenant. `resolveFreshMembership`
filters soft-deleted accounts.

## Redirect-URL guard

`assertAllowedBillingRedirectUrl(value, field)` allows only the
configured `FRONTEND_URL` origin. Stripe-hosted flows must round-trip
back to a host we control; accepting arbitrary URLs is open-redirect
bait.
