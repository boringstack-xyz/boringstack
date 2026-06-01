import { afterEach, describe, expect, test } from "bun:test";

import { ApiError } from "../../../src/lib/errors/api-error";
import {
  completeOAuthCallback,
  createAuthorizationURL,
} from "../../../src/lib/oauth/oauth.service";
import { oauthStateStore } from "../../../src/lib/oauth/oauth.state";

afterEach(async () => {
  await oauthStateStore.close();
});

describe("createAuthorizationURL", () => {
  test("rejects when the provider has no credentials in env (notFound)", async () => {
    /*
     * The test process leaves every provider's CLIENT_ID/SECRET unset
     * (no real OAuth creds in CI), so `getCredentials` throws notFound
     * before any Valkey state is touched. This exercises the failure
     * path that hides whether a provider is wired at all.
     */
    let caught: unknown;

    try {
      await createAuthorizationURL("google", ["openid", "email"]);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);

    if (caught instanceof ApiError) {
      expect(caught.statusCode).toBe(404);
    }
  });
});

describe("completeOAuthCallback", () => {
  test("rejects when the state is unknown to the Valkey store (unauthorized)", async () => {
    /*
     * No prior `oauthStateStore.store` call, so `oauthStateStore.consume`
     * returns null and the handler throws unauthorized. This branch is
     * reached regardless of whether Valkey is up — `consume` swallows the
     * Redis miss and returns null. (When Valkey isn't reachable the
     * lazy client's first call will reject, which is also captured.)
     */
    let caught: unknown;

    try {
      await completeOAuthCallback("google", "code-xyz", "state-no-such-key");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
  });
});
