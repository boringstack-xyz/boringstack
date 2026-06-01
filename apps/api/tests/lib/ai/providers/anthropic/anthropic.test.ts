import { describe, expect, test } from "bun:test";

import { AnthropicProvider } from "../../../../../src/lib/ai/providers/anthropic/anthropic";
import type { IAnthropicMessagesClient } from "../../../../../src/lib/ai/providers/anthropic/anthropic.types";
import { ApiError } from "../../../../../src/lib/errors";

describe("AnthropicProvider", () => {
  test("constructor accepts an API key and tags itself as 'anthropic'", () => {
    const provider = new AnthropicProvider("sk-ant-fake-key");

    expect(provider.providerName).toBe("anthropic");
  });

  test("chat() wraps SDK failures in an ApiError tagged externalService", async () => {
    const messages: IAnthropicMessagesClient = {
      create: () => Promise.reject(new Error("synthetic Anthropic failure")),
    };
    const provider = new AnthropicProvider("sk-ant-fake-key", messages);

    let captured: unknown;

    try {
      await provider.chat({ model: "claude-haiku-4-5", userMessage: "hi" });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeDefined();
    expect(captured).toBeInstanceOf(ApiError);

    if (!(captured instanceof ApiError)) {
      throw new Error("Expected ApiError");
    }

    expect(captured.statusCode).toBe(502);
  });
});
