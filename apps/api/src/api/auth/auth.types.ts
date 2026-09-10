import type { IUser } from "../users/users.types";

/**
 * User shape returned by `/login`, `/verify-email`, and `/oauth/...`
 * to the SPA. Platform-admin status is deliberately NOT part of this
 * payload: that flag is server-side state, gating the `/admin` mount,
 * and product surfaces should never branch on it. Forks that want a
 * staff-only UI should build a separate admin app behind its own
 * auth gate.
 */
export interface IPublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

export interface IRegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

/**
 * Returned by `authService.register`. Only carries the (normalized)
 * email so the route can render "we sent a link to that address"
 * without leaking user ids before verification.
 */
export interface IPendingRegistration {
  email: string;
}

/*
 * Discriminated union so the route can branch cleanly on whether to
 * issue session cookies inline or detour through the MFA challenge
 * flow. `mfaRequired: false` keeps the existing route shape; the
 * `true` variant carries just the userId so the route can hand it to
 * `mfaService.issueChallenge` without re-querying.
 */
export type ILoginResult =
  | { mfaRequired: false; user: IPublicUser }
  | { mfaRequired: true; userId: string };

/**
 * Returned by `emailVerificationService.verify` and by the OAuth
 * callback service. Includes the freshly-provisioned (or existing)
 * accountId so the route can sign a JWT with the right `aid` claim.
 */
export interface IAuthenticatedResult {
  user: IPublicUser;
  accountId: string;
}

export interface ICreatedSession {
  token: string;
  expiresAt: string;
}

export interface IRefreshedSession {
  token: string;
  user: IPublicUser;
}

/*
 * Outcome of the detect-and-rotate transaction in SessionService.refresh.
 * Declared as a discriminated union so each branch's literal `kind` is
 * preserved by the return type without needing `as const` at call sites
 * (consistent-type-assertions: never forbids them).
 */
export type IRefreshOutcome =
  | { kind: "missing" }
  | { kind: "expired" }
  | {
      kind: "replay";
      userId: string;
      sessionId: string;
      familyId: string;
    }
  | { kind: "rotated"; userId: string };

export interface IMessageResult {
  message: string;
}

/**
 * What `requireAuth` puts on the request context.
 *
 * `credential` carries the token's own identity and lifetime so a handler
 * that outlives the request — an SSE stream, a long poll — can re-check
 * them. The guard reads them once, at admission; a connection held open
 * for hours has to keep checking, or logout and expiry stop applying to it.
 */
export interface IAuthenticatedContext {
  user: IUser;
  accountId: string;
  credential: IAuthCredential;
}

export interface IAuthCredential {
  /** Per-issuance id, revoked individually by logout. Null on legacy tokens. */
  readonly jti: string | null;
  /** Issued-at, compared against the user-wide revoke-before cutoff. */
  readonly issuedAt: number | null;
  /** Expiry. A stream must close when its own credential lapses. */
  readonly expiresAt: number | null;
}

export interface IOAuthLoginResult {
  user: IPublicUser;
  accountId: string;
  isNew: boolean;
  /**
   * Whether the account requires a second factor. MFA is a property of the
   * account rather than of one login route, so the OAuth callback has to
   * make the same decision the password route does.
   */
  mfaRequired: boolean;
}
