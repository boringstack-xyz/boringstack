# Email — Cloudflare Email Service

This template defaults to [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) for transactional outbound mail. When you're already on Cloudflare for DNS + a Workers Paid plan, this is the cheapest production-grade option available — outbound sending is bundled into the Workers Paid subscription, with no documented per-message cost.

## TL;DR

Set two envs and you're done:

```env
EMAIL_PROVIDER=cloudflare              # already the default
EMAIL_FROM=noreply@<your-cf-domain>
CLOUDFLARE_ACCOUNT_ID=<from CF dashboard right sidebar>
CLOUDFLARE_EMAIL_API_TOKEN=<API token with "Email Sending: Edit">
```

In dev with either of those two unset, the noop provider logs the rendered email payload to stdout instead of sending. No "test mode" flag needed.

## How it works

`buildEmailService()` (in `src/lib/email/email.service.utils.ts`) constructs a `CloudflareEmailService` that POSTs to:

```
https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/email/sending/send
```

with `Authorization: Bearer {CLOUDFLARE_EMAIL_API_TOKEN}` and a JSON body containing `from`, `to`, `subject`, `html`, and (optionally) `text`. Provider receives **already-rendered HTML** from the template service — your Handlebars templates under `src/templates/email/` are unchanged.

Retries + structured logging are handled by the shared `retryWithBackoff()` helper used by every provider in this folder. No special-case Cloudflare wiring.

## Switching providers

The `EMAIL_PROVIDER` env supports three values: `cloudflare`, `resend`, `sendgrid`. Set the var, set the matching key(s), restart. In `NODE_ENV=production` the env validator fails the boot if the selected provider's credentials are missing.

## Operator setup

DNS, Workers Paid plan, API token creation, and domain verification all live in the **infra** runbook so it stays close to deployment: [infra-docker-compose-template/docs/runbooks/cloudflare-email.md](../../../infra/compose/docs/runbooks/cloudflare-email.md).

## Caveats

- **Beta product.** Pricing, daily limits, and bounce semantics may shift before GA. The provider implementation is small (one POST + body shape); revisit when the docs stabilize.
- **New accounts** can only send to verified addresses until you upgrade. The infra runbook covers the unlock step.
- **DNS must be on Cloudflare.** SPF/DKIM/DMARC are auto-provisioned during domain enrollment; we don't manage them in this template.
