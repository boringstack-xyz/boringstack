# Authentication

Read this when touching `src/api/auth/**`, `src/lib/cookies/`, or any
route that needs the current user / account.

## Building blocks

- JWT in HTTP-only cookies (`@elysiajs/jwt`). Cookie config lives in
  `src/lib/cookies/`. Spread `AUTH_COOKIE_CONFIG` rather than ad-hoc
  cookie options.
- bcrypt with `BCRYPT_ROUNDS` ≥ 12 (`jwt-cookies/bcrypt-rounds-min`).
- OAuth via `arctic` for Google / GitHub / LinkedIn. State persists in
  Valkey with a short TTL, never in cookies (`oauth-security` plugin). The
  browser holds one thing: a binding nonce whose hash is stored beside the
  state. The callback refuses any state without a stored hash, so a state
  written by an older build makes the user restart sign-in.
- `tests/api/auth/auth.roles.test.ts` covers the role grants.

## Protecting a route group

```ts
const r = createAuthMiddleware()
  .get("/me", ({ user }) => user)
  .patch("/me", ({ user, body }) => usersService.updateProfile(user.id, body), {
    body: UpdateMeSchema,
  });
```

Public routes (login, webhooks) skip the middleware; they're plain
`new Elysia()` chains.

## Roles

`createRequireRoleMiddleware(["admin"])` for admin-only routes. Roles
live in `src/api/auth/auth.roles.ts` plus the `auth.roles.constants.ts`

- `auth.roles.types.ts` siblings.

## Refresh sessions and replay

A refresh token rotates on every use. Each rotation records the hash it
retired in `auth.session_retired_tokens`, so presenting an old token at any
depth is recognised as a replay rather than as an unknown token.

A detected replay deletes the whole family: every refresh token in that
rotation chain stops working, current and retired alike, and an
`AUTH_REFRESH_REPLAY` audit row is written.

What it does not do, today:

**Access tokens already issued stay valid until they expire.** A replay
revokes the refresh family, not the JWTs minted from it, so a token in the
browser keeps working for the rest of its 15-minute lifetime unless
something else revokes it (logout revokes its `jti`; a password reset and
"sign out everywhere" bump the user-wide cutoff). Closing that window means
a user-wide revocation on replay, which would sign the user out of unrelated
sessions and devices. That is a product decision, not a bug fix, and it is
tracked separately. `security-spec/f06-refresh-replay-revokes-family.test.ts`
asserts the current behaviour so a change to it is deliberate.

### Rolling deploys

The lineage table is what makes replay detection work at depth. Two rules
follow from that:

- **Deploy writers that keep the lineage before relying on depth beyond one
  generation.** An instance on the previous build rotates a token and writes
  only `previous_token_hash`. A rotation on the new build carries that slot
  into the lineage table, so one old rotation is covered. Two or more
  consecutive rotations handled entirely by old writers discard history no
  writer ever persisted, and those generations cannot be recovered.
- **Retire affected families during cutover** if you need the stronger
  guarantee immediately. Flushing state is not a substitute while old
  writers are still serving traffic.

The same shape applies to the OAuth binding: fixing new instances does not
secure callbacks still being handled by old ones. Drain or upgrade the old
instances, and expect users mid-flow to restart sign-in.
