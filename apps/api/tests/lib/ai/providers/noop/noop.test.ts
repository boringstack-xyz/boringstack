import { describe, expect, it } from "bun:test";
import { NoopAIProvider } from "../../../../../src/lib/ai/providers/noop";

describe("NoopAIProvider", () => {
  it("returns an empty placeholder response without throwing", async () => {
    const provider = new NoopAIProvider();
    const result = await provider.chat({
      model: "gpt-4o-mini",
      userMessage: "ping",
    });

    expect(result.content).toBe("");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.finishReason).toBe("noop");
    expect(provider.providerName).toBe("noop");
  });
});
