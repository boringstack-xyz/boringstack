import { describe, expect, test } from "vitest";

import { OAUTH_PROVIDERS } from "./oauth.manifest";

/**
 * Canonical provider list shared with api-template
 * (`api-template/src/lib/oauth/oauth.manifest.ts`). Update both when adding a
 * provider. ui-template CI runs in isolation — it cannot import the API repo.
 */
const API_OAUTH_PROVIDERS = ["google", "github", "linkedin"] as const;

describe("OAUTH_PROVIDERS", () => {
  test("matches the api-template oauth.manifest.ts provider list", () => {
    expect([...OAUTH_PROVIDERS]).toEqual([...API_OAUTH_PROVIDERS]);
  });
});
