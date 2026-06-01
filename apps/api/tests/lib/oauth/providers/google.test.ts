import { describe, expect, test } from "bun:test";

import { googleProvider } from "../../../../src/lib/oauth/providers/google";
import { DEFAULT_OAUTH_SCOPES } from "../../../../src/lib/oauth/oauth.manifest";

describe("googleProvider", () => {
  test("exposes the IOAuthProviderModule contract", () => {
    expect(typeof googleProvider.buildAuthorizationURL).toBe("function");
    expect(typeof googleProvider.exchangeCode).toBe("function");
    expect(typeof googleProvider.fetchProfile).toBe("function");
  });

  test("declares the canonical Google default scopes (OIDC: openid+email+profile)", () => {
    expect(googleProvider.defaultScopes).toEqual([
      ...DEFAULT_OAUTH_SCOPES.google,
    ]);
    expect(googleProvider.defaultScopes).toContain("openid");
    expect(googleProvider.defaultScopes).toContain("email");
  });

  test("buildAuthorizationURL produces a google.com URL with state + a PKCE verifier", () => {
    const result = googleProvider.buildAuthorizationURL(
      {
        clientId: "id",
        clientSecret: "secret",
        redirectURI: "https://app.example/oauth/google/callback",
      },
      "STATE_GOOGLE",
      ["openid", "email"]
    );

    expect(result.url).toBeInstanceOf(URL);
    expect(result.url.host).toMatch(/google\.com$/u);
    expect(result.url.searchParams.get("state")).toBe("STATE_GOOGLE");
    expect(typeof result.codeVerifier).toBe("string");
    expect(result.codeVerifier.length).toBeGreaterThan(0);
  });
});
