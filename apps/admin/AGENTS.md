# Operator dashboard: agent guide

`apps/admin` is a LAN-only operator dashboard for the BoringStack API. It has
no login. It talks to the admin API process (`apps/api/src/admin.ts`), which
acts as the platform admin resolved at boot.

| When you are doing this                                  | Read this                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Learning what the dashboard shows and how it is released | [docs: operator dashboard](../docs/src/content/docs/admin/overview.mdx) |
| Adding or changing an admin route, or the request guard  | [admin process](../api/docs/agents/admin-process.md)                    |
| Changing the bundle, or raising a size limit             | `budgets.md` and `.size-limit.json` in this app                         |
| Changing the k3s overlay                                 | [k3s render test](../../infra/k3s/tests/admin.test.ts)                  |

`bun run validate` is the gate here: lint, format, typecheck, tests, the
production build, the bundle size check and the budget gate. Typecheck runs
`tsc` (TypeScript 6) and `typecheck:native` (TypeScript 7, the Go compiler, about
5x faster); both must pass.

Rules that keep this app safe:

- Every request to the admin API carries `x-boringstack-admin: 1` (see
  `src/lib/admin-api.ts` for reads and `src/lib/admin-write.ts` for writes).
  The API refuses reads and writes without it and refuses any browser request
  whose `sec-fetch-site` is not same-origin. Writes also need a JSON body.
- Add a page only when it reads or writes data the admin API already serves, or
  when you also add the route and its tests to the admin API. Never call the
  public API from here.
- Show user and account ids, never emails or free-form metadata.
- Keep it opt-in. It is off unless `WITH_ADMIN=1`, and it is never routed by
  Traefik.
- A bundle limit goes up only with a reason line in `budgets.md`. The gate
  compares against the base branch, so an old reason cannot cover a later raise.
