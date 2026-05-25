import { describe, expect, it } from "bun:test";
import { aiProvider } from "../../../src/lib/ai/provider-factory";

/**
 * The factory reads the *frozen* `env` singleton at module load — we can't
 * mutate it per test. With the test seed (AI_ENABLED unset), the factory
 * always returns the noop provider. These tests cover what the wired-up
 * factory returns under the test-mode env.
 */
describe("aiProvider", () => {
  it("returns the noop provider in test mode (AI_ENABLED unset)", () => {
    expect(aiProvider.providerName).toBe("noop");
  });

  it("noop accepts any model id without throwing", async () => {
    const out = await aiProvider.chat({
      model: "gpt-4o-mini",
      userMessage: "ping",
    });

    expect(out.content).toBe("");
    expect(out.model).toBe("gpt-4o-mini");
  });
});
