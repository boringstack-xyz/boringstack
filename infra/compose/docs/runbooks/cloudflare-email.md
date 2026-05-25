# Cloudflare Email Service — operator runbook

Step-by-step setup for outbound transactional email via [Cloudflare Email Service](https://developers.cloudflare.com/email-service/). This is what the api-template defaults to (`EMAIL_PROVIDER=cloudflare`).

## Prerequisites

- A Cloudflare account.
- The sending domain's DNS managed by Cloudflare (the orange-cloud setup in the CF dashboard).
- **Workers Paid plan** — $5/mo. Email sending is bundled; the docs do not (as of beta) publish a separate per-message rate. Cheaper than every standalone transactional service at any non-trivial volume.

## 1 — Enable Workers Paid

CF dashboard → Workers & Pages → Plans → upgrade to Paid. One-time, account-scoped.

## 2 — Enable Email Service on the sending domain

CF dashboard → Email → Email Service → Enable for your domain.

Cloudflare auto-provisions the DNS records you need:

| Record | Name | Notes |
|---|---|---|
| MX | `cf-bounce.<domain>` | Bounce + complaint routing |
| TXT (SPF) | `<domain>` | `v=spf1 include:_spf.mx.cloudflare.net ~all` |
| TXT (DKIM) | `cf-bounce._domainkey.<domain>` | Cloudflare-signed |
| TXT (DMARC) | `_dmarc.<domain>` | Default `p=none`; tighten when stable |

Propagation: 5–15 minutes.

## 3 — Capture the account ID

CF dashboard → any zone for the account → right sidebar → **Account ID**. Copy it; this becomes `CLOUDFLARE_ACCOUNT_ID`.

## 4 — Create the API token

CF dashboard → My Profile → API Tokens → Create Token → Custom.

- **Permission**: `Account` → `Email Sending` → `Edit`.
- **Account resources**: Include → the account you just enabled Email Service on.
- **TTL**: leave open or pick a rotation window.

Click **Continue to summary**, then **Create Token**. **Copy the value now** — Cloudflare shows it exactly once.

This becomes `CLOUDFLARE_EMAIL_API_TOKEN`.

## 5 — Wire into compose

Edit `compose/api.prod.env` (copy from `api.prod.env.example` if you haven't):

```env
EMAIL_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=<from step 3>
CLOUDFLARE_EMAIL_API_TOKEN=<from step 4>
EMAIL_FROM=noreply@<your-cf-domain>
```

Restart the API:

```bash
STACK=prod ./scripts/compose-up.sh
```

The env validator will fail the boot loudly if either Cloudflare var is empty when `EMAIL_PROVIDER=cloudflare`.

## 6 — Smoke test

Trigger a real flow (signup, password reset) and confirm:

1. The email arrives in your inbox.
2. The api-dev logs show `event: email_sent`, `provider: cloudflare`, and a non-empty `messageId`.
3. CF dashboard → Email → Sending → recent events lists the message.

If a send fails with a 403, the most common cause is an unverified destination on a new (non-upgraded) account; the API token + domain are usually fine. Verify the destination in CF dashboard, or upgrade the account to remove the restriction.

## Beta caveats

- **Pricing**: bundled into Workers Paid as of this writing; CF may change the model. Re-check the docs at GA.
- **Daily limits**: variable, account-scoped. The Limit Increase Request Form is in the dashboard.
- **Sending restrictions for new accounts**: only verified destinations until you upgrade.

## Rotating the token

1. Create a new token (step 4) with the same scope.
2. Update `CLOUDFLARE_EMAIL_API_TOKEN` in `compose/api.prod.env`.
3. `STACK=prod ./scripts/compose-up.sh` to recreate the API container.
4. CF dashboard → My Profile → API Tokens → **Roll** or **Delete** the old token.

## Switching providers

The api-template supports `cloudflare` (default), `resend`, and `sendgrid`. To switch, set `EMAIL_PROVIDER=resend` (or `sendgrid`) and provide the matching key — no other change required. The provider abstraction is in `src/lib/email/providers/`.
