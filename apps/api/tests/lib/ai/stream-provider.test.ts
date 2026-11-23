import { describe, expect, test } from "bun:test";

import {
  buildStreamingProvider,
  type IStreamingSettings,
} from "../../../src/lib/ai/stream-provider";

const enabled: IStreamingSettings = {
  enabled: true,
  provider: "openrouter",
  apiKey: "sk-or-test",
  baseUrl: "https://openrouter.example/api/v1",
  dataCollection: "deny",
};

describe("buildStreamingProvider", () => {
  test("builds an OpenRouter streamer when enabled and keyed", () => {
    expect(buildStreamingProvider(enabled)?.providerName).toBe("openrouter");
  });

  test("stays off unless AI_ENABLED is set", () => {
    expect(buildStreamingProvider({ ...enabled, enabled: false })).toBeNull();
  });

  test("stays off for any provider other than openrouter", () => {
    expect(
      buildStreamingProvider({ ...enabled, provider: "openai" })
    ).toBeNull();
    expect(
      buildStreamingProvider({ ...enabled, provider: "anthropic" })
    ).toBeNull();
    expect(buildStreamingProvider({ ...enabled, provider: "noop" })).toBeNull();
  });

  test("stays off without an API key, so startup never depends on it", () => {
    expect(buildStreamingProvider({ ...enabled, apiKey: "" })).toBeNull();
  });
});
