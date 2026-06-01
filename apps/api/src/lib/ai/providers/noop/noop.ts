import { logger } from "../../../../config/logger";
import type {
  AIProviderName,
  IAIChatOptions,
  IAIProvider,
  IAIResponse,
} from "../../types";

/**
 * No-op AI provider used when `AI_ENABLED=false` or no API key is configured.
 * Returns a placeholder response so call sites stay unconditional during
 * development. Tests can also pin this to avoid hitting real providers.
 */
export class NoopAIProvider implements IAIProvider {
  public readonly providerName: AIProviderName = "noop";

  chat(options: IAIChatOptions): Promise<IAIResponse> {
    logger.info("🤖 [noop] AI request skipped (no provider configured)", {
      event: "ai_noop",
      model: options.model,
    });

    return Promise.resolve({
      content: "",
      model: options.model,
      finishReason: "noop",
    });
  }
}
