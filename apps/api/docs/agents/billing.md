# Billing (Stripe)

Read this when touching `src/api/billing/**` or anything that handles a
Stripe webhook.

## Lint contract

The `stripe-webhooks` plugin enforces:

- `Stripe-Signature` header is read **before** any body parsing.
- `stripe.webhooks.constructEvent(...)` is called with the raw body +
  signature + secret.
- The handler is idempotent (uses `cacheService` with the event ID as
  the dedup key — see `billing.service.ts`).

## Configuration

Price IDs come from env (`STRIPE_PRICE_ID_FREE`, `STRIPE_PRICE_ID_PRO`,
and the optional `STRIPE_PRICE_ID_PRO_YEARLY`), never hardcoded. An empty
yearly ID means yearly is not offered. The validator refuses a yearly ID equal
to the monthly one, since that would make the webhook's price-to-plan mapping
ambiguous.

`Stripe never knows about feature keys.` The app derives feature
gating from `account_plans` at request time; Stripe only triggers the
plan-key update via webhook.

## Plan catalog

`billing.plans.ts` is the single declaration of the built-in plans: name,
default flag, the price ID per interval and the feature values. Pro's values
are typed against `FEATURES` (`PlanFeatureValues` requires a key for every
feature), so adding a feature key fails the type check until Pro gets a value.
`billing.plans.test.ts` repeats that check at runtime. `PRO_SEAT_LIMIT` (10) is
the place to change the Pro seat limit.

Free carries no `plan_features` rows: a missing key resolves to its `FEATURES`
default. `ensureConfiguredPlans` upserts the plan rows and their feature rows on
every call, and deletes stored feature rows the catalog does not assign to a
built-in plan. Consequence: a hand-edit to Free or Pro in the database is
overwritten on the next plan read. Use `account_feature_overrides` for
per-account exceptions.

## Public plan list

`GET /api/v1/billing/plans` is public (no auth) so a pricing page can read it.
It only touches the database and env-derived catalog, never the Stripe client.
When `BILLING_ENABLED=false` it still answers, with `purchasableIntervals: []`
on every plan. The other billing routes keep returning 404 while billing is
disabled (`getBillingService()` gates them).

`purchasableIntervals` lists the intervals a checkout can be started for: billing
enabled, the plan is not the default, and that interval's price is set.

## Checkout

`POST /billing/stripe/checkout-session` takes an optional `interval`
(`month` default, or `year`). Errors:

- Default (Free) plan: 400 `invalidInput`, before any Stripe call.
- Interval with no configured price: 400 `invalidInput` on `interval`.

The account row is locked (`SELECT ... FOR UPDATE`) for the whole sequence,
so two quick clicks serialize. Inside the lock:

1. A local `account_plans` row that is not `canceled` rejects with 409
   ("Manage your existing subscription from Billing").
2. A Stripe subscription for the customer that is not `canceled` or
   `incomplete_expired` rejects with 409. This covers the window before the
   webhook lands.
3. An open Checkout session for the same account, plan and price is returned
   instead of creating another. The session's `metadata.priceId` carries the
   price for that match.

The Stripe client is injectable (`new BillingService({ stripe, settings })`),
so tests run against a real `Stripe` client with a fake HTTP layer
(`createFakeStripe` in `tests/helpers/stripe-webhook-fixtures.ts`).

## Payment status

`checkout.session.completed` sets `active` only when `payment_status` is
`paid` or `no_payment_required`. Otherwise (`unpaid`, as with bank debit) the
row is `incomplete`, which does not entitle (`isPlanEntitling`).

- `checkout.session.async_payment_succeeded`: sets `active` on the matching row.
- `checkout.session.async_payment_failed`: sets `incomplete` on the matching row.

When the row already belongs to the same subscription, a `completed` event only
records its event id and timestamp. The `customer.subscription.*` events stay
the authority for status. The async events set status because they are the only
signal that a delayed payment settled or failed.

## Yearly and monthly price mapping

`customer.subscription.created` and `.updated` map a subscription's price to a
plan through the catalog: either Pro price maps to Pro. The stored
`plans.stripe_price_id` holds the monthly price only, so the mapping must not
read that column.
