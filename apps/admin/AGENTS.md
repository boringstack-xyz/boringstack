# Operator dashboard: agent guide

`apps/admin` is a LAN-only operator dashboard for the BoringStack API. It has
no login. It talks to the admin API process (`apps/api/src/admin.ts`), which
acts as the platform admin resolved at boot. Read the API guide first:
[admin process](../api/docs/agents/admin-process.md).

`bun run validate` is the gate here: lint, format, typecheck, tests and the
production build. Typecheck runs `tsc` (TypeScript 6) and `typecheck:native`
(TypeScript 7, the Go compiler, about 5x faster); both must pass.

Rules that keep this app safe:

- Every request to the admin API carries `x-boringstack-admin: 1` (see
  `src/lib/admin-api.ts`). The API refuses reads and writes without it and
  refuses any browser request whose `sec-fetch-site` is not same-origin.
- Add a page only when it reads data the admin API already serves, or when you
  also add the route and its tests to the admin API. Never call the public API
  from here.
- Show user and account ids, never emails or free-form metadata.
- Keep it opt-in. It is off unless `WITH_ADMIN=1`, and it is never routed by
  Traefik.
