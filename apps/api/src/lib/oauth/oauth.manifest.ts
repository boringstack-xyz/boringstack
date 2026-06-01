/**
 * OAuth static data only — no provider modules — so provider files can
 * import helpers from oauth.utils without circular initialization with
 * oauth.constants / oauth.registry.
 */

export const OAUTH_PROVIDERS = ["google", "github", "linkedin"] as const;

/** Default scopes per provider; override at the call site if needed. */
export const DEFAULT_OAUTH_SCOPES = {
  google: ["openid", "email", "profile"],
  github: ["read:user", "user:email"],
  linkedin: ["openid", "profile", "email"],
} as const;

/** Maps each provider to the env-var keys holding its credentials. */
export const OAUTH_ENV_KEYS = {
  google: {
    id: "GOOGLE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_OAUTH_CLIENT_SECRET",
  },
  github: {
    id: "GITHUB_OAUTH_CLIENT_ID",
    secret: "GITHUB_OAUTH_CLIENT_SECRET",
  },
  linkedin: {
    id: "LINKEDIN_OAUTH_CLIENT_ID",
    secret: "LINKEDIN_OAUTH_CLIENT_SECRET",
  },
} as const;
