import { describe, expect, test } from "bun:test";

import {
  DEFAULT_OAUTH_SCOPES,
  OAUTH_ENV_KEYS,
  OAUTH_PROVIDERS,
} from "../../../src/lib/oauth/oauth.manifest";

describe("OAUTH_PROVIDERS", () => {
  test("lists the three first-class providers", () => {
    expect(OAUTH_PROVIDERS).toEqual(["google", "github", "linkedin"]);
  });
});

describe("DEFAULT_OAUTH_SCOPES", () => {
  test("every provider has a default scope set", () => {
    for (const provider of OAUTH_PROVIDERS) {
      expect(DEFAULT_OAUTH_SCOPES[provider].length).toBeGreaterThan(0);
    }
  });

  test("google requests an OIDC-shaped scope set", () => {
    expect(DEFAULT_OAUTH_SCOPES.google).toContain("openid");
    expect(DEFAULT_OAUTH_SCOPES.google).toContain("email");
  });

  test("github requests user:email (needed to resolve the primary verified address)", () => {
    expect(DEFAULT_OAUTH_SCOPES.github).toContain("user:email");
  });
});

describe("OAUTH_ENV_KEYS", () => {
  test("every provider declares both an id and a secret env var", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const entry = OAUTH_ENV_KEYS[provider];

      expect(entry.id).toMatch(/CLIENT_ID$/u);
      expect(entry.secret).toMatch(/CLIENT_SECRET$/u);
    }
  });

  test("env-var names are upper-snake-cased with the provider prefix", () => {
    expect(OAUTH_ENV_KEYS.google.id).toBe("GOOGLE_OAUTH_CLIENT_ID");
    expect(OAUTH_ENV_KEYS.github.secret).toBe("GITHUB_OAUTH_CLIENT_SECRET");
    expect(OAUTH_ENV_KEYS.linkedin.id).toBe("LINKEDIN_OAUTH_CLIENT_ID");
  });
});
