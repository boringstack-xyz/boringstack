import { env } from "../../config/env";
import { parseDefaultHeaders } from "./ai.utils";
import { AnthropicProvider } from "./providers/anthropic";
import { NoopAIProvider } from "./providers/noop";
import {
  OpenAIProvider,
  type IOpenAIProviderOptions,
} from "./providers/openai";
import type { IAIProvider } from "./types";

const buildOpenAI = (): IAIProvider | null => {
  if (env.OPENAI_API_KEY === "") {
    return null;
  }

  const headers = parseDefaultHeaders(env.OPENAI_DEFAULT_HEADERS);
  const options: IOpenAIProviderOptions = {
    apiKey: env.OPENAI_API_KEY,
    ...(env.OPENAI_BASE_URL !== "" && { baseURL: env.OPENAI_BASE_URL }),
    ...(headers !== undefined && { defaultHeaders: headers }),
  };

  return new OpenAIProvider(options);
};

const buildOpenRouter = (): IAIProvider | null => {
  if (env.OPENROUTER_API_KEY === "") {
    return null;
  }

  return new OpenAIProvider({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    providerName: "openrouter",
  });
};

const buildAnthropic = (): IAIProvider | null => {
  return env.ANTHROPIC_API_KEY === ""
    ? null
    : new AnthropicProvider(env.ANTHROPIC_API_KEY);
};

/**
 * Selects the AI provider based on env. Mirrors the email/cache pattern:
 *
 *   AI_ENABLED=false           → NoopAIProvider
 *   AI_PROVIDER=openai         → OpenAIProvider (configurable baseURL,
 *                                works for OpenAI, OpenRouter, Ollama,
 *                                vLLM, LM Studio, Together, Groq, etc.)
 *   AI_PROVIDER=anthropic      → AnthropicProvider (native API)
 *   AI_PROVIDER=openrouter     → OpenAIProvider pointed at OPENROUTER_BASE_URL
 *                                (chat only; streaming is in stream-provider.ts)
 *
 * If the chosen provider's API key is missing, falls back to noop so call
 * sites stay unconditional during local dev / boot.
 */
export const buildAIProvider = (): IAIProvider => {
  if (!env.AI_ENABLED) {
    return new NoopAIProvider();
  }

  switch (env.AI_PROVIDER) {
    case "openai":
      return buildOpenAI() ?? new NoopAIProvider();
    case "anthropic":
      return buildAnthropic() ?? new NoopAIProvider();
    case "openrouter":
      return buildOpenRouter() ?? new NoopAIProvider();
    case "noop":
      return new NoopAIProvider();
  }
};
