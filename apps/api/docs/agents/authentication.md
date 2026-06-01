# Authentication

Read this when touching `src/api/auth/**`, `src/lib/cookies/`, or any
route that needs the current user / account.

## Building blocks

- JWT in HTTP-only cookies (`@elysiajs/jwt`). Cookie config lives in
  `src/lib/cookies/`. Spread `AUTH_COOKIE_CONFIG` rather than ad-hoc
  cookie options.
- bcrypt with `BCRYPT_ROUNDS` ≥ 12 (`jwt-cookies/bcrypt-rounds-min`).
- OAuth via `arctic` for Google / GitHub / LinkedIn. State persists in
  Valkey with a short TTL — never in cookies (`oauth-security` plugin).
- `tests/api/auth/auth.roles.test.ts` covers the role grants.

## Protecting a route group

```ts
const r = createAuthMiddleware()
  .get("/me", ({ user }) => user)
  .patch("/me", ({ user, body }) => usersService.updateProfile(user.id, body), {
    body: UpdateMeSchema,
  });
```

Public routes (login, webhooks) skip the middleware — they're plain
`new Elysia()` chains.

## Roles

`createRequireRoleMiddleware(["admin"])` for admin-only routes. Roles
live in `src/api/auth/auth.roles.ts` plus the `auth.roles.constants.ts`

- `auth.roles.types.ts` siblings.
