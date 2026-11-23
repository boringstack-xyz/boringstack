# Production verification: the robot

A robot walks the whole product in production as a brand-new user, after
every release and every six hours. If anything a person could hit is broken,
the run fails and an issue opens (`notify-failures.yml`).

- Workflow: `.github/workflows/production-verification.yml`
- Journeys: `apps/ui/e2e/robot/*.spec.ts`
- Run it by hand: `cd apps/ui && bun run robot`

## Nothing ships outside the robot

The robot is not a sample of the product; it is held to all of it.

| What                    | Listed in                             | Kept complete by                                                       | Kept true by                                                                                   |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Every app route         | `apps/ui/e2e/robot/coverage.ts`       | `apps/ui/src/app/router/routes.test.tsx` (part of `bun run validate`)  | the journey named must exist                                                                   |
| Every API operation     | `apps/ui/e2e/robot/api-coverage.ts`   | the same test, against the generated `src/lib/api/schema.d.ts`         | `e2e/robot/check-api-coverage.ts`: a run fails when a passed journey never called what it claims |

Each entry names the journeys that open the page or call the operation, or a
`notChecked` reason a reviewer can read. So:

- A new page or endpoint fails `validate` until it has a robot journey or a
  written reason. Regenerating the API client (`bun run generate:api`) is what
  brings a new endpoint into the check.
- A journey that stops calling an operation it claims (the UI changed, a step
  was removed) fails the next robot run, on the PR and in production.
- Every journey also fails on any script error or any 5xx answer on the pages
  it opens, even when the page looks fine.

## Before a change ships

The same journeys run on every PR that touches the apps, against the PR's own
stack (`infra-compose-playwright-e2e.yml`, step "Run the production robot's
journeys"), with the dev stack's loose request limits and no public site.
After a release the robot runs main's code. It never checks out the release
run's commit, because the job holds the robot secret and a run started from
another branch would hand it that branch's code; it only follows releases of
main in this repository.

## What it walks

| Journeys | File | Needs the secret |
| --- | --- | --- |
| Visitor: sign-in page and cookie banner, unknown account refused, sign-up and forgot-password pages, token links without a token, members-only redirects, not-found | `visitor.spec.ts` | no |
| Public site: every address in the sitemap answers with a page, the home page leads into the app, not-found answers 404 | `site.spec.ts` | no |
| Member: sign up, refused before verifying (and resend), verify and log in, profile, workspace rename, notifications, audit log, join requests, billing, Stripe checkout (production only), free plan cannot invite, Pro can invite, invite/resend/revoke a robot teammate, change password, log back in and sign out, two-factor on/regenerate/sign in with a code/off, delete the workspace, password reset request, removal | `member.spec.ts` | yes |

Add your product's journeys to these files (or new `*.spec.ts` files in the
same folder) as you build: the coverage test will tell you which ones are
missing.

## The robot's account

- It signs up as `run-<uuid>@robot.boringstack.invalid` (renamed with the
  project). `.invalid` can never receive mail, and the API never sends to that
  domain.
- The one step a robot cannot do is click the emailed link. In its place it
  calls `POST /api/v1/auth/synthetic/verify` with the secret.
  `/synthetic/upgrade` puts its own account on Pro without payment (plan
  source `synthetic`), and `/synthetic/cleanup` removes it at the end.
- All three answer 404 unless the caller sends the exact
  `SYNTHETIC_CHECK_SECRET` in `x-synthetic-secret`, and with it they still
  refuse any address outside the robot's domain. Holding the secret never
  reaches a real account. A secret shorter than 32 characters stops the API
  at boot.
- Robot accounts write no audit-log rows, log their sign-up as
  `auth.register.synthetic` (so sign-up alerts count people), never share an
  account through domain claiming, and get no email. One left behind by a run
  that died is removed within a day by account maintenance.
- Payments: in production the robot opens Stripe's checkout page and enters
  nothing. No money moves.

## Arming it (once)

1. Generate a secret: `openssl rand -hex 32`.
2. Give it to the production API as `SYNTHETIC_CHECK_SECRET`
   (`infra/k3s/overlays/prod/secrets`, or your secret manager).
3. GitHub, repository secret `SYNTHETIC_CHECK_SECRET`: the same value.
4. GitHub, repository variables: `ROBOT_APP_URL` (for example
   `https://app.example.com`), and optionally `ROBOT_SITE_URL`,
   `ROBOT_SITE_MIN_PAGES`, `ROBOT_LIVE_SERVICES=true` (Stripe is live).

The workflow does nothing until `ROBOT_APP_URL` is set. Without the secret
the member journeys are skipped with a warning on the run. To disarm, remove
the API's secret: the routes go back to 404.

## Pace

Production limits each address to 100 API requests a minute at the edge and
`AUTH_RATE_LIMIT_MAX` (10) a minute on the sign-in routes. The robot does not
get past those limits; it waits its turn under them
(`e2e/robot/fixtures/pace.ts`), which is why a full run takes about ten
minutes. `ROBOT_API_PER_MINUTE` and `ROBOT_SIGN_IN_PER_MINUTE` change its pace
for a stack with other limits.

## Running it against another stack

```sh
cd apps/ui
SYNTHETIC_CHECK_SECRET=<the stack's secret> \
ROBOT_APP_URL=http://127.0.0.1:7331 \
bun run robot
```

The local dev stack (`./setup.sh --up`) already sets
`dev-stack-only-verification-robot-0000` as its secret. Use `127.0.0.1`
rather than `localhost` when another project's containers hold the IPv6
loopback.

## When it fails

Open the run: the failed journey's name says what a person could not do. The
`robot-report` artifact has a screenshot, a video and a trace of the failure.
A failure in "is offered checkout" points at Stripe rather than our code. A
failure from `check-api-coverage.ts` names the operation and the journey that
no longer calls it: fix the journey, or move the entry to `notChecked` with
the reason.
