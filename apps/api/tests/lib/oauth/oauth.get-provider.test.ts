import { describe, expect, test } from "bun:test";

import { OAUTH_PROVIDERS } from "../../../src/lib/oauth/oauth.manifest";
import { getProvider } from "../../../src/lib/oauth/oauth.get-provider";
import { PROVIDER_MODULES } from "../../../src/lib/oauth/oauth.registry";

describe("getProvider", () => {
  test.each([...OAUTH_PROVIDERS])(
    "returns the registered module for %s",
    (provider) => {
      expect(getProvider(provider)).toBe(PROVIDER_MODULES[provider]);
    }
  );
});
