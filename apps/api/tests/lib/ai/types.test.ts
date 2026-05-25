import { describe, expect, test } from "bun:test";

import type {
  AIProviderName,
  IAIChatOptions,
  IAIProvider,
  IAIResponse,
  IAIUsage,
  IChatMessage,
} from "../../../src/lib/ai/types";

/*
 * `types.ts` is pure type declarations — there is no runtime to exercise.
 * The value of a test here is type-level: assert the public contract is
 * stable so accidental renames or shape changes fail the build, not a
 * runtime probe in production.
 */

describe("ai/types — type-level contract", () => {
  test("AIProviderName narrows to the supported set", () => {
    const allowed: readonly AIProviderName[] = ["openai", "anthropic", "noop"];

    expect(allowed).toContain("openai");
    expect(allowed).toContain("anthropic");
    expect(allowed).toContain("noop");
  });

  test("IChatMessage can be constructed for every supported role", () => {
    const messages: IChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "system", content: "you are a helpful assistant" },
    ];

    expect(messages).toHaveLength(3);
  });

  test("IAIUsage requires the three token counts", () => {
    const usage: IAIUsage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    };

    expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
  });

  test("IAIChatOptions accepts the minimal `model` shape", () => {
    const opts: IAIChatOptions = { model: "gpt-4o-mini", userMessage: "hi" };

    expect(opts.model).toBe("gpt-4o-mini");
    expect(opts.userMessage).toBe("hi");
  });

  test("IAIResponse + IAIProvider can be constructed together", async () => {
    const response: IAIResponse = { content: "ok", model: "test" };
    const provider: IAIProvider = {
      providerName: "noop",
      chat: () => Promise.resolve(response),
    };

    expect(provider.providerName).toBe("noop");

    const result = await provider.chat({ model: "test" });

    expect(result.content).toBe("ok");
  });
});
