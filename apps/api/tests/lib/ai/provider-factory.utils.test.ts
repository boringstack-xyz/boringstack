import { describe, expect, test } from "bun:test";

import { buildAIProvider } from "../../../src/lib/ai/provider-factory.utils";

describe("buildAIProvider", () => {
  test("returns a provider with a known providerName", () => {
    const provider = buildAIProvider();

    expect(provider).toBeDefined();
    expect(typeof provider.chat).toBe("function");
    expect(typeof provider.providerName).toBe("string");
  });

  test("providerName is one of the known providers", () => {
    const provider = buildAIProvider();
    const valid: readonly string[] = ["openai", "anthropic", "noop"];

    expect(valid.includes(provider.providerName)).toBe(true);
  });

  test("returns the same provider name on repeated calls", () => {
    const first = buildAIProvider();
    const second = buildAIProvider();

    expect(first.providerName).toBe(second.providerName);
  });

  test("provider responds to chat without throwing (noop under test env)", async () => {
    const provider = buildAIProvider();
    const result = await provider.chat({
      model: "test-model",
      userMessage: "ping",
    });

    expect(result).toBeDefined();
    expect(typeof result.content).toBe("string");
    expect(result.model).toBe("test-model");
  });
});
