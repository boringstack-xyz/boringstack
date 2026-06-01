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

Plan IDs come from env (`STRIPE_PRICE_ID_FREE`, `STRIPE_PRICE_ID_PRO`)
— never hardcoded.

`Stripe never knows about feature keys.` The app derives feature
gating from `account_plans` at request time; Stripe only triggers the
plan-key update via webhook.
