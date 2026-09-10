import { generateState } from "arctic";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../audit-log";
import { ApiErrors, getErrorMessage } from "../errors";
import { generateOpaqueToken, hashOpaqueToken } from "../tokens";
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

  /*
   * The browser-binding nonce. Only its hash is stored, so a Valkey snapshot
   * cannot be replayed as a browser.
   */
  const bindingNonce = generateOpaqueToken();
  const stored: IStoredState = { bindingHash: hashOpaqueToken(bindingNonce) };

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
    ? { url, state, bindingNonce, codeVerifier }
    : { url, state, bindingNonce };
};

/**
 * Verify state, exchange the authorization code, then fetch + normalize
 * the user profile. Throws an `ApiError` (401/502) on every failure path.
 */
export const completeOAuthCallback = async (
  provider: OAuthProvider,
  code: string,
  state: string,
  bindingNonce: string
): Promise<{ profile: IOAuthProfile; linkUserId?: string }> => {
  /*
   * Resolve credentials BEFORE consuming state. When credentials aren't
   * configured the provider can't possibly have issued this callback,
   * surface 404 immediately instead of burning a state lookup against
   * Valkey (which may be unreachable in the same misconfigured deploys).
   */
  const creds = getCredentials(provider);
  const module = getProvider(provider);

  const stored = await oauthStateStore.consume(state);

  if (stored === null) {
    throw ApiErrors.unauthorized("Invalid or expired OAuth state");
  }

  /*
   * The browser presenting this callback must be the one that started the
   * flow. Without that, holding a valid state is enough: an attacker begins
   * authorization for their own identity and hands the callback URL to a
   * victim, whose browser completes it and ends up signed in as the
   * attacker.
   *
   * State with no stored hash is refused rather than waved through. Treating
   * a missing hash as "nothing to check" reinstates the whole attack for any
   * state an attacker can get written without one, and every state this
   * build writes carries a hash. A state issued by an older build is refused
   * too: the user restarts sign-in, which costs a redirect.
   *
   * Checked before the code is exchanged, so a rejected callback never
   * reaches the provider. State is consumed above either way, so a failed
   * binding burns it rather than leaving it for a retry.
   */
  const boundHash = stored.bindingHash;

  if (
    boundHash === undefined ||
    boundHash === "" ||
    bindingNonce === "" ||
    hashOpaqueToken(bindingNonce) !== boundHash
  ) {
    throw ApiErrors.unauthorized(
      "This sign-in was not started in this browser"
    );
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
