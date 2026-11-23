# Admin process (LAN-only operator API)

The admin API is a separate process, `src/admin.ts`, on `ADMIN_PORT` (default
7340). It is built from the same source as the public API and mounts only
`/health` and `/api/v1/admin/*`. The public app (`src/config/app/app.ts`) never
mounts `/api/v1/admin`, and `tests/config/app/admin-app.test.ts` proves it.

## Operator

- It has no login. At boot, `src/boot/operator.ts` resolves one platform admin
  (`users.is_platform_admin = true`). `ADMIN_OPERATOR_USER_ID` pins one when
  several exist. Boot aborts when the choice is ambiguous or missing.
- `requireOperator()` chains onto the routes it guards, and rejects with 403
  when no operator was resolved. It never allows by default.

## Request guard

`src/middleware/admin-request-guard.ts` runs on every request:

- Reads outside `/api/v1/admin` (health, the OpenAPI document) pass.
- Admin reads need `x-boringstack-admin: 1` and no cross-site
  `sec-fetch-site`.
- Writes also need a JSON body, so a plain form never reaches a handler.

The header name carries the project token, so `rename-project.sh` keeps the API
and the dashboard in step.

## Routes

- `GET /api/v1/admin/queues`: job counts through plain BullMQ `Queue` handles
  (`src/queues/queue-stats.readonly.ts`). It never opens a worker or a
  scheduler.
- `GET /api/v1/admin/audit?limit=&before=`: the recent audit log, newest first,
  with user and account ids only. No emails and no metadata.

Admin routes are not in the public OpenAPI document. Keep them that way: if a
route ever moves into the public app, it needs a robot coverage entry in
`apps/ui/e2e/robot/api-coverage.ts`.
