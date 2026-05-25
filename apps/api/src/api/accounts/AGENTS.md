# Accounts + invitations

## `InvitationsService.accept(token, userId, userEmail)`

Signature is `(token, userId, userEmail)` — all three are required.
The flow:

1. Lookup by `tokenHash` with `isNull(acceptedAt) && isNull(revokedAt)` → `notFound` if missing.
2. `expiresAt <= now` → `validation("Invitation has expired")`.
3. `normalizeInvitationEmail(invitation.email) !== normalizeInvitationEmail(userEmail)` → `forbidden("Invitation can only be accepted by the invited email address")`.
4. UPDATE inside a transaction with the same `isNull(acceptedAt) && isNull(revokedAt)` re-check on the WHERE.

If you touch the signature, every acceptance test in
`tests/api/accounts/invitations.service.test.ts` must seed the invitee
user with an email that **equals the invited email**. The mismatch
guard fires before `acceptedAt` / `expiresAt` / `revokedAt` checks, so a
fixture mismatch surfaces as the wrong assertion failing.

## Email normalization

`normalizeInvitationEmail` (in `invitations.utils.ts`) is the only
correct way to compare invitation emails. Always call it on both sides
of every comparison.

## Contract surface

- `AGENT_CONTRACT.md` in the repo root defines the resource quintet:
  `accounts.routes.ts` / `accounts.service.ts` / `accounts.utils.ts` /
  `accounts.constants.ts` / `accounts.schemas.ts`. Same for `invitations.*`.
  ESLint enforces — routes can't import drizzle-orm, services can't
  import elysia plugins, etc.
- `lint:meta` rejects a service/utils/jobs/check/routes file without a
  sibling test under `tests/api/accounts/`.
