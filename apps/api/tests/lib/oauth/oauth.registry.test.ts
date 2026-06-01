import { describe, expect, test } from "bun:test";

import { OAUTH_PROVIDERS } from "../../../src/lib/oauth/oauth.manifest";
import { PROVIDER_MODULES } from "../../../src/lib/oauth/oauth.registry";

describe("PROVIDER_MODULES", () => {
  test("registers a module for every provider in the manifest", () => {
    for (const provider of OAUTH_PROVIDERS) {
      expect(PROVIDER_MODULES[provider]).toBeDefined();
    }
  });

  test("every module exposes the IOAuthProviderModule contract", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const mod = PROVIDER_MODULES[provider];

      expect(typeof mod.buildAuthorizationURL).toBe("function");
      expect(typeof mod.exchangeCode).toBe("function");
      expect(typeof mod.fetchProfile).toBe("function");
      expect(Array.isArray(mod.defaultScopes)).toBe(true);
    }
  });

  test("registry keys match the manifest exactly with no extras", () => {
    const registered = new Set(Object.keys(PROVIDER_MODULES));
    const declared = new Set(OAUTH_PROVIDERS);

    expect(registered).toEqual(declared);
  });
});
