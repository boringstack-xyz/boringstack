import { env } from "../../config/env";
import { OpenRouterProvider } from "./providers/openrouter";
import type { IStreamingAIProvider } from "./stream.types";
import type { AIProviderName } from "./types";

export interface IStreamingSettings {
  readonly enabled: boolean;
  readonly provider: AIProviderName;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly dataCollection: "allow" | "deny";
}

/*
 * Streaming is served by OpenRouter only, and is off unless AI_ENABLED is
 * set and AI_PROVIDER=openrouter. Returns null otherwise, so a product's
 * streaming route can answer "unavailable" without startup depending on it.
 */
export const buildStreamingProvider = (
  settings: IStreamingSettings
): IStreamingAIProvider | null => {
  if (
    !settings.enabled ||
    settings.provider !== "openrouter" ||
    settings.apiKey === ""
  ) {
    return null;
  }

  return new OpenRouterProvider({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    dataCollection: settings.dataCollection,
  });
};

export const streamingProvider = buildStreamingProvider({
  enabled: env.AI_ENABLED,
  provider: env.AI_PROVIDER,
  apiKey: env.OPENROUTER_API_KEY,
  baseUrl: env.OPENROUTER_BASE_URL,
  dataCollection: env.OPENROUTER_DATA_COLLECTION,
});
