import type { OAUTH_PROVIDERS } from "./oauth.manifest";

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Normalized user profile each provider must produce. Per-provider
 * userinfo responses get mapped into this shape so the upsert logic
 * stays provider-agnostic.
 */
export interface IOAuthProfile {
  /** Stable provider-side id (`sub` for OIDC, numeric `id` for GitHub). */
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

export interface IOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectURI: string;
}

export interface IAuthorizationURLResult {
  url: URL;
  state: string;
  /** PKCE verifier — present only for providers that support PKCE (Google). */
  codeVerifier?: string;
}

/**
 * One implementation per provider. Each module owns the arctic client
 * construction, the default scopes, and the userinfo fetch+parse — the
 * orchestration layer just dispatches.
 */
export interface IOAuthProviderModule {
  defaultScopes: string[];
  buildAuthorizationURL: (
    creds: IOAuthCredentials,
    state: string,
    scopes: string[]
  ) => { url: URL; codeVerifier?: string };
  exchangeCode: (
    creds: IOAuthCredentials,
    code: string,
    codeVerifier: string | undefined
  ) => Promise<{ accessToken: string }>;
  fetchProfile: (accessToken: string) => Promise<IOAuthProfile>;
}

/** Persisted server-side between authorize → callback. */
export interface IStoredState {
  codeVerifier?: string;
  /** When set, the callback links the provider to this user instead of login. */
  linkUserId?: string;
}
