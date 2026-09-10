/**
 * F01c: GitHub email verification is inconsistent.
 *
 * The security review identified this inconsistency directly: "Fetching
 * `/user/emails` only when the public email is absent produces inconsistent
 * verification behavior." What it did not state is the direction, and the
 * direction decides what there is to test.
 *
 * `src/lib/oauth/providers/github.ts:122-129`:
 *
 *   const directEmail = readString(profile, "email");
 *   const { email, verified } =
 *     directEmail !== ""
 *       ? { email: directEmail, verified: readBoolean(profile, "email_verified") }
 *       : await this.fetchPrimaryEmail(accessToken);
 *
 * GitHub's `/user` response has no `email_verified` field, and `readBoolean`
 * (src/lib/oauth/oauth.utils.ts:88) is strict: `return obj[key] === true`, so
 * a missing key yields `false`. Every GitHub user with a public profile email
 * therefore arrives as unverified, trips the guard in
 * `oauth.service.ts:124`, and has their signup transaction rolled back.
 *
 * It fails CLOSED, not open. That makes it an availability bug: GitHub
 * signup is broken for public-email users, and it incidentally shuts the
 * F01a takeover for GitHub specifically. Google and LinkedIn read genuine OIDC `email_verified`
 * and are where F01a is live.
 *
 * The fix is to resolve verification through the documented email endpoint
 * regardless of whether a public email is present.
 * https://docs.github.com/en/rest/users/emails
 */
import { afterEach, describe, expect, test } from "bun:test";

import { githubProvider } from "../src/lib/oauth/providers/github";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/**
 * Stubs the two GitHub endpoints the provider may call. `emails` is what
 * `/user/emails` returns; a test that omits it asserts the endpoint is not
 * consulted.
 */
const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/*
 * Resolves the request URL without relying on default stringification: the
 * input union is `RequestInfo | URL`, and only `Request` and `URL` carry a
 * meaningful textual form.
 */
const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input;
};

/**
 * Stubs the two GitHub endpoints the provider may call. A test that asserts
 * `/user/emails` is consulted relies on `emails` being returned only there.
 */
const stubGithub = (user: unknown, emails: unknown): void => {
  const handler = (input: RequestInfo | URL): Promise<Response> =>
    Promise.resolve(
      urlOf(input).includes("/user/emails")
        ? jsonResponse(emails)
        : jsonResponse(user)
    );

  /*
   * Bun's `fetch` carries a `preconnect` member alongside the call
   * signature, so the stub has to keep it to remain assignable. Borrow the
   * real one rather than assert the shape away.
   */
  globalThis.fetch = Object.assign(handler, {
    preconnect: realFetch.preconnect,
  });
};

describe("F01c GitHub email verification", () => {
  test("a public profile email is verified via the email endpoint", async () => {
    stubGithub({ id: 4242, login: "octocat", email: "octocat@example.com" }, [
      { email: "octocat@example.com", primary: true, verified: true },
    ]);

    const profile = await githubProvider.fetchProfile("token-abc");

    /*
     * Today this is `false`, because `/user` carries no `email_verified` and
     * the provider does not fall back to `/user/emails` when a public email
     * is present. That false propagates into a rolled-back signup.
     */
    expect(profile.emailVerified).toBe(true);
  });

  test("an unverified primary email stays unverified", async () => {
    stubGithub({ id: 4243, login: "mona", email: "mona@example.com" }, [
      { email: "mona@example.com", primary: true, verified: false },
    ]);

    const profile = await githubProvider.fetchProfile("token-abc");

    // Negative control: the fix must not blanket-trust the public email.
    expect(profile.emailVerified).toBe(false);
  });

  test("control: the no-public-email path already works", async () => {
    stubGithub({ id: 4244, login: "hubot", email: null }, [
      { email: "hubot@example.com", primary: true, verified: true },
    ]);

    const profile = await githubProvider.fetchProfile("token-abc");

    expect(profile.email).toBe("hubot@example.com");
    expect(profile.emailVerified).toBe(true);
  });
});
