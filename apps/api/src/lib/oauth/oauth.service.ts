import { generateState } from "arctic";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../audit-log";
import { ApiErrors, getErrorMessage } from "../errors";
import { oauthStateStore } from "./oauth.state";
import type {
  IAuthorizationURLResult,
  IOAuthProfile,
  IStoredState,
  OAuthProvider,
} from "./oauth.types";
import { getProvider } from "./oauth.get-provider";
import { getCredentials } from "./oauth.utils";

/**
 * Build the URL the browser is redirected to and persist the matching
 * state (and PKCE verifier when the provider supports it). Caller
 * redirects the user to `result.url`.
 */
export const createAuthorizationURL = async (
  provider: OAuthProvider,
  scopes: string[],
  options?: { linkUserId?: string }
): Promise<IAuthorizationURLResult> => {
  const creds = getCredentials(provider);
  const state = generateState();
  const { url, codeVerifier } = getProvider(provider).buildAuthorizationURL(
    creds,
    state,
    scopes
  );

  const stored: IStoredState = {};

  if (codeVerifier !== undefined) {
    stored.codeVerifier = codeVerifier;
  }

  if (options?.linkUserId !== undefined) {
    stored.linkUserId = options.linkUserId;
  }

  await oauthStateStore.store(state, stored);

  void auditLogService.record({
    userId: null,
    action: AUDIT_ACTIONS.AUTH_OAUTH_AUTHORIZATION_URL_CREATED,
    metadata: { provider, hasPkce: codeVerifier !== undefined },
  });

  return codeVerifier !== undefined
    ? { url, state, codeVerifier }
    : { url, state };
};

/**
 * Verify state, exchange the authorization code, then fetch + normalize
 * the user profile. Throws an `ApiError` (401/502) on every failure path.
 */
export const completeOAuthCallback = async (
  provider: OAuthProvider,
  code: string,
  state: string
): Promise<{ profile: IOAuthProfile; linkUserId?: string }> => {
  /*
   * Resolve credentials BEFORE consuming state. When credentials aren't
   * configured the provider can't possibly have issued this callback —
   * surface 404 immediately instead of burning a state lookup against
   * Valkey (which may be unreachable in the same misconfigured deploys).
   */
  const creds = getCredentials(provider);
  const module = getProvider(provider);

  const stored = await oauthStateStore.consume(state);

  if (stored === null) {
    throw ApiErrors.unauthorized("Invalid or expired OAuth state");
  }

  try {
    const { accessToken } = await module.exchangeCode(
      creds,
      code,
      stored.codeVerifier
    );

    const profile = await module.fetchProfile(accessToken);

    void auditLogService.record({
      userId: null,
      action: AUDIT_ACTIONS.AUTH_OAUTH_CALLBACK_COMPLETED,
      metadata: { provider, providerUserId: profile.providerUserId },
    });

    return {
      profile,
      linkUserId: stored.linkUserId,
    };
  } catch (error: unknown) {
    logger.error("OAuth callback failed", {
      event: "oauth_callback_failed",
      provider,
      error: getErrorMessage(error),
    });

    throw ApiErrors.externalService(
      `OAuth callback failed for provider '${provider}'`
    );
  }
};
