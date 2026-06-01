import { describe, expect, test } from "bun:test";

import { linkedinProvider } from "../../../../src/lib/oauth/providers/linkedin";
import { DEFAULT_OAUTH_SCOPES } from "../../../../src/lib/oauth/oauth.manifest";

describe("linkedinProvider", () => {
  test("exposes the IOAuthProviderModule contract", () => {
    expect(typeof linkedinProvider.buildAuthorizationURL).toBe("function");
    expect(typeof linkedinProvider.exchangeCode).toBe("function");
    expect(typeof linkedinProvider.fetchProfile).toBe("function");
  });

  test("declares the canonical LinkedIn default scopes (OIDC)", () => {
    expect(linkedinProvider.defaultScopes).toEqual([
      ...DEFAULT_OAUTH_SCOPES.linkedin,
    ]);
    expect(linkedinProvider.defaultScopes).toContain("openid");
    expect(linkedinProvider.defaultScopes).toContain("email");
  });

  test("buildAuthorizationURL produces a linkedin.com URL with state", () => {
    const result = linkedinProvider.buildAuthorizationURL(
      {
        clientId: "id",
        clientSecret: "secret",
        redirectURI: "https://app.example/oauth/linkedin/callback",
      },
      "STATE_LI",
      ["openid", "email", "profile"]
    );

    expect(result.url).toBeInstanceOf(URL);
    expect(result.url.host).toMatch(/linkedin\.com$/u);
    expect(result.url.searchParams.get("state")).toBe("STATE_LI");
  });
});
