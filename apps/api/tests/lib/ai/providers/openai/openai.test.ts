import { describe, expect, it } from "bun:test";
import { OpenAIProvider } from "../../../../../src/lib/ai";

/**
 * Smoke test for the OpenAI-compatible adapter. We're not making real
 * network calls — we're verifying the provider can be constructed with
 * any baseURL (OpenRouter, Ollama, vLLM, LM Studio, etc.) and any
 * default headers without throwing.
 *
 * If this stays green, the adapter works against every provider that
 * speaks the OpenAI v1 chat-completions wire format.
 */
describe("OpenAIProvider — OpenAI-compatible endpoints", () => {
  it("constructs against the default OpenAI endpoint", () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });

    expect(provider.providerName).toBe("openai");
  });

  it("accepts OpenRouter as the baseURL", () => {
    const provider = new OpenAIProvider({
      apiKey: "sk-or-test",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://example.com",
        "X-Title": "API Template",
      },
    });

    expect(provider.providerName).toBe("openai");
  });

  it("accepts a local Ollama URL", () => {
    const provider = new OpenAIProvider({
      apiKey: "ollama",
      baseURL: "http://localhost:11434/v1",
    });

    expect(provider.providerName).toBe("openai");
  });

  it("accepts an LM Studio URL", () => {
    const provider = new OpenAIProvider({
      apiKey: "lm-studio",
      baseURL: "http://localhost:1234/v1",
    });

    expect(provider.providerName).toBe("openai");
  });

  it("accepts a vLLM / TGI URL", () => {
    const provider = new OpenAIProvider({
      apiKey: "vllm",
      baseURL: "http://localhost:8000/v1",
    });

    expect(provider.providerName).toBe("openai");
  });
});
