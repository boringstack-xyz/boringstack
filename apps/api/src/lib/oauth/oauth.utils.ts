import { env } from "../../config/env";
import type { Env } from "../../config/env";
import { ApiErrors } from "../errors";
import { OAUTH_ENV_KEYS, OAUTH_PROVIDERS } from "./oauth.manifest";
import type { IOAuthCredentials, OAuthProvider } from "./oauth.types";

export const isValidOAuthProvider = (value: string): value is OAuthProvider => {
  const providerSet: ReadonlySet<string> = new Set(OAUTH_PROVIDERS);

  return providerSet.has(value);
};

export type OAuthCredentialSource = Pick<
  Env,
  | (typeof OAUTH_ENV_KEYS)[OAuthProvider]["id"]
  | (typeof OAUTH_ENV_KEYS)[OAuthProvider]["secret"]
>;

export const getConfiguredOAuthProviders = (
  source: OAuthCredentialSource = env
): OAuthProvider[] =>
  OAUTH_PROVIDERS.filter((provider) => {
    const keys = OAUTH_ENV_KEYS[provider];

    return source[keys.id] !== "" && source[keys.secret] !== "";
  });

/*
 * ---------------------------------------------------------------------------
 * Credentials reading
 * ---------------------------------------------------------------------------
 */

const publicApiRoot = (): string => {
  const trimmed = env.PUBLIC_API_URL.replace(/\/+$/, "");

  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
};

export const buildRedirectURI = (provider: OAuthProvider): string =>
  `${publicApiRoot()}/api/v1/auth/oauth/${provider}/callback`;

/**
 * Reads provider credentials from env. Missing creds → 404 to keep the
 * provider's existence undisclosed when not configured. Same model as
 * billing routes when `BILLING_ENABLED=false`.
 */
export const getCredentials = (provider: OAuthProvider): IOAuthCredentials => {
  const keys = OAUTH_ENV_KEYS[provider];
  const clientId = env[keys.id];
  const clientSecret = env[keys.secret];

  if (
    typeof clientId !== "string" ||
    clientId === "" ||
    typeof clientSecret !== "string" ||
    clientSecret === ""
  ) {
    throw ApiErrors.notFound(`OAuth provider '${provider}'`);
  }

  return {
    clientId,
    clientSecret,
    redirectURI: buildRedirectURI(provider),
  };
};

/*
 * ---------------------------------------------------------------------------
 * JSON narrowing helpers (used by every provider's profile parser)
 * ---------------------------------------------------------------------------
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export const readString = (obj: unknown, key: string): string => {
  if (!isRecord(obj)) {
    return "";
  }

  const value = obj[key];

  return typeof value === "string" ? value : "";
};

export const readBoolean = (obj: unknown, key: string): boolean => {
  if (!isRecord(obj)) {
    return false;
  }

  return obj[key] === true;
};

/**
 * Best-effort split of a single display name into first / last. Used by
 * providers that don't return structured name fields (notably GitHub).
 */
export const splitDisplayName = (
  full: string
): { firstName: string; lastName: string } => {
  const trimmed = full.trim();

  if (trimmed === "") {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
};

/** Wraps `fetch` for OAuth-shaped JSON; throws on non-2xx. */
export const fetchJson = async (
  url: string,
  init: RequestInit
): Promise<unknown> => {
  const res = await fetch(url, init);

  if (!res.ok) {
    const body = await res.text();

    throw ApiErrors.externalService(
      `HTTP ${String(res.status)} from ${url}: ${body}`
    );
  }

  return res.json();
};
