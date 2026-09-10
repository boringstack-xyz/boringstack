/**
 * F02: OAuth state is not bound to the initiating browser.
 *
 * `IStoredState` (oauth.types.ts:53-58) holds exactly two optional fields,
 * `codeVerifier` and `linkUserId`. `createAuthorizationURL`
 * (oauth.service.ts:33-43) stores only those, and neither start route touches
 * cookies (`auth.routes.ts:420-432`, `:574-588`). The callback validates that
 * `query.state` is a non-empty string and then consumes it
 * (`auth.routes.ts:487-495`); nothing the browser holds is compared.
 *
 * The state's existence does not establish that the browser presenting it
 * began the flow. An attacker starts authorization for their own account and
 * hands the unused callback URL to a victim, whose browser is then logged into
 * the attacker's identity. PKCE does not close this: it protects the code
 * exchange, and the server takes its verifier from the same state the attacker
 * supplied. RFC 9700 requires protection against authorization-response CSRF.
 *
 * What these tests assert
 * -----------------------
 * The security outcome, whether a session is issued, rather than a status
 * code. A status assertion can be satisfied by unrelated changes, such as
 * mapping a provider failure to 400, and would not mean the browser binding
 * exists. Issuing no `auth_token` to a browser that did not start the flow is
 * the property that matters, and it holds regardless of how the fix is shaped.
 *
 * The provider exchange is stubbed, so the flow completes locally and the
 * tests do not depend on Google's endpoint or on network behaviour.
 *
 * Two things the review noted that are deliberately kept: the absence of a
 * cookie is lint-enforced (`eslint.config.js:772`,
 * `oauth-security/state-must-be-redis-backed`) and documented as intentional
 * (`docs/agents/authentication.md:12`). The fix is a binding nonce alongside
 * Valkey-held state, and that rule has to learn the difference.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createApp } from "../src/config/app/app";
import { oauthStateStore } from "../src/lib/oauth/oauth.state";
import { cleanDatabase } from "../tests/helpers/db";
import {
  callback,
  issuesSession,
  restoreFetch,
  startFlow,
  stubGoogle,
} from "./fixtures/oauth-flow";
import {
  requireDbOrFail,
  requireValkeyOrFail,
  specPrecondition,
} from "./harness";

beforeEach(async () => {
  await requireDbOrFail();
  await requireValkeyOrFail();
  await cleanDatabase();
  stubGoogle({ sub: "google-spec-f02", email: "f02-victim@gmail.com" });
});

afterEach(() => {
  restoreFetch();
});

describe("F02 OAuth state binds to the initiating browser", () => {
  test("a callback replayed in another browser issues no session", async () => {
    const app = createApp();

    // The attacker begins a flow and keeps whatever the browser was given.
    const { state } = await startFlow(app);

    /*
     * The victim's browser follows the handed-out callback URL. It holds
     * nothing from the start request, which is the login-CSRF shape RFC 9700
     * requires protection against, and the state is still unconsumed.
     */
    const res = await callback(app, state, "");

    expect(issuesSession(res)).toBe(false);
  });

  test("control: the initiating browser completes the flow", async () => {
    const app = createApp();

    const { state, cookies } = await startFlow(app);

    const res = await callback(app, state, cookies);

    /*
     * Proves the stubbed provider, the state store and the callback all work
     * together, so a rejection above is about browser binding rather than a
     * broken fixture. Binding must not break the legitimate flow, so this stays green.
     */
    expect(issuesSession(res)).toBe(true);
  });

  test("control: an authenticated link flow completes in the same browser", async () => {
    const app = createApp();
    const { seedVerifiedUser } = await import("../tests/helpers/auth");

    await seedVerifiedUser({ email: "f02-linker@gmail.com" });

    /* Linking requires the provider email to match the signed-in account. */
    stubGoogle({ sub: "google-spec-f02-link", email: "f02-linker@gmail.com" });

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "f02-linker@gmail.com",
          password: "Hunter2Strong!",
        }),
      })
    );

    const sessionCookies = loginRes.headers
      .getAll("set-cookie")
      .map((chunk) => chunk.split(";")[0])
      .join("; ");

    specPrecondition(sessionCookies !== "", "login issued no cookies");

    /*
     * Linking is a second start route onto the same callback, so it owes
     * the browser the same binding nonce. Without it the callback rejects
     * a flow the user started correctly and provider linking is simply
     * broken: a binding that refuses the legitimate path is not a
     * binding, it is an outage.
     */
    const { state, cookies } = await startFlow(app, {
      link: true,
      sessionCookies,
    });

    const res = await callback(app, state, `${sessionCookies}; ${cookies}`);

    expect(res.status).toBeLessThan(400);
  });

  test("control: state is consumed exactly once", async () => {
    const state = "spec-f02-once";

    await oauthStateStore.store(state, {});

    expect(await oauthStateStore.consume(state)).not.toBeNull();
    expect(await oauthStateStore.consume(state)).toBeNull();
  });
});
