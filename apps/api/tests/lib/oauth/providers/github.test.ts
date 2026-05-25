import { describe, expect, test } from "bun:test";

import { githubProvider } from "../../../../src/lib/oauth/providers/github";
import { DEFAULT_OAUTH_SCOPES } from "../../../../src/lib/oauth/oauth.manifest";

describe("githubProvider", () => {
  test("exposes the IOAuthProviderModule contract", () => {
    expect(typeof githubProvider.buildAuthorizationURL).toBe("function");
    expect(typeof githubProvider.exchangeCode).toBe("function");
    expect(typeof githubProvider.fetchProfile).toBe("function");
    expect(Array.isArray(githubProvider.defaultScopes)).toBe(true);
  });

  test("declares the canonical GitHub default scopes (user:email is required)", () => {
    expect(githubProvider.defaultScopes).toEqual([
      ...DEFAULT_OAUTH_SCOPES.github,
    ]);
    expect(githubProvider.defaultScopes).toContain("user:email");
  });

  test("buildAuthorizationURL produces a github.com URL with state + the requested scopes", () => {
    const result = githubProvider.buildAuthorizationURL(
      {
        clientId: "id",
        clientSecret: "secret",
        redirectURI: "https://app.example/oauth/github/callback",
      },
      "STATE_XYZ",
      ["user:email"]
    );

    expect(result.url).toBeInstanceOf(URL);
    expect(result.url.host).toBe("github.com");
    expect(result.url.searchParams.get("state")).toBe("STATE_XYZ");
    expect(result.url.searchParams.get("scope") ?? "").toContain("user:email");
  });
});
