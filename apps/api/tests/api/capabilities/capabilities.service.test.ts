import { describe, expect, test } from "bun:test";

import { CapabilitiesService } from "../../../src/api/capabilities/capabilities.service";

describe("CapabilitiesService", () => {
  test("returns the public capability envelope", () => {
    const capabilities = new CapabilitiesService().get();

    expect(typeof capabilities.features.notifications.sse).toBe("boolean");
    expect(typeof capabilities.features.notifications.webPush).toBe("boolean");
    expect(typeof capabilities.features.billing.enabled).toBe("boolean");
    expect(typeof capabilities.features.ai.enabled).toBe("boolean");
    expect(Array.isArray(capabilities.oauth.providers)).toBe(true);
  });
});
