/**
 * A hermetic Google OAuth flow for the route-level specs.
 *
 * Both F02 (browser binding) and F07 (MFA coverage) need to drive the real
 * callback to its conclusion and then ask whether a session was issued. That
 * requires standing in for Google's token and userinfo endpoints: otherwise
 * the tests depend on network behaviour and on an external service's error
 * mapping, neither of which is a property of this codebase.
 */
import type { createApp } from "../../src/config/app/app";
import { AUTH_COOKIE_NAME } from "../../src/lib/cookies";
import { specPrecondition } from "../harness";

const realFetch = globalThis.fetch;

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input;
};

/** Stands in for Google's token and userinfo endpoints. */
export const stubGoogle = (profile: {
  sub: string;
  email: string;
  emailVerified?: boolean;
}): void => {
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = urlOf(input);

    if (url.includes("oauth2.googleapis.com/token")) {
      return Promise.resolve(
        jsonResponse({
          access_token: "spec-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        })
      );
    }

    if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return Promise.resolve(
        jsonResponse({
          sub: profile.sub,
          email: profile.email,
          email_verified: profile.emailVerified ?? true,
          given_name: "Spec",
          family_name: "User",
        })
      );
    }

    return Promise.reject(new Error(`unexpected outbound fetch: ${url}`));
  };

  globalThis.fetch = Object.assign(handler, {
    preconnect: realFetch.preconnect,
  });
};

export const restoreFetch = (): void => {
  globalThis.fetch = realFetch;
};

export interface IStartedFlow {
  readonly state: string;
  readonly cookies: string;
}

/**
 * Begins authorization and captures whatever the browser is left holding.
 *
 * `sessionCookies` drives the AUTHENTICATED link flow instead of login. Both
 * start routes must hand the browser a binding nonce, since the shared
 * callback requires one.
 */
export const startFlow = async (
  app: ReturnType<typeof createApp>,
  options: { link?: boolean; sessionCookies?: string } = {}
): Promise<IStartedFlow> => {
  const path =
    options.link === true
      ? "/api/v1/auth/oauth/google/link"
      : "/api/v1/auth/oauth/google";

  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      redirect: "manual",
      headers:
        options.sessionCookies === undefined
          ? {}
          : { cookie: options.sessionCookies },
    })
  );

  specPrecondition(
    res.status === 302,
    `expected a redirect into the provider, got ${res.status}`
  );

  const location = res.headers.get("location") ?? "";
  const state = new URL(location).searchParams.get("state");

  specPrecondition(
    state !== null && state !== "",
    "authorization start issued no state parameter"
  );

  const cookies = res.headers
    .getAll("set-cookie")
    .map((chunk) => chunk.split(";")[0])
    .join("; ");

  return { state, cookies };
};

export const callback = async (
  app: ReturnType<typeof createApp>,
  state: string,
  cookies: string
): Promise<Response> =>
  app.handle(
    new Request(
      `http://localhost/api/v1/auth/oauth/google/callback?code=spec-code&state=${state}`,
      { redirect: "manual", headers: cookies === "" ? {} : { cookie: cookies } }
    )
  );

/** Whether the response hands the browser an authenticated session. */
export const issuesSession = (res: Response): boolean =>
  res.headers
    .getAll("set-cookie")
    .some((chunk) => chunk.startsWith(`${AUTH_COOKIE_NAME}=`));
