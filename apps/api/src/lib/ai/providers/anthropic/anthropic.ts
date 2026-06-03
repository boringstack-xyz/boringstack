import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../../errors";
import { DEFAULT_MAX_TOKENS } from "../../constants";
import type {
  AIProviderName,
  IAIChatOptions,
  IAIProvider,
  IAIResponse,
} from "../../types";
import type { IAnthropicMessagesClient } from "./anthropic.types";
import { extractText, toAnthropicMessages } from "./anthropic.utils";

const AI_REQUEST_TIMEOUT_MS = 60_000;

export class AnthropicProvider implements IAIProvider {
  public readonly providerName: AIProviderName = "anthropic";
  private readonly messages: IAnthropicMessagesClient;

  constructor(apiKey: string, messages?: IAnthropicMessagesClient) {
    if (messages !== undefined) {
      this.messages = messages;

      return;
    }

    // The SDK default is 10 minutes — far past any request budget.
    const client = new Anthropic({ apiKey, timeout: AI_REQUEST_TIMEOUT_MS });

    this.messages = {
      create: (body) => client.messages.create(body),
    };
  }

  async chat(options: IAIChatOptions): Promise<IAIResponse> {
    try {
      const message = await this.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: toAnthropicMessages(options),
        ...(options.systemPrompt !== undefined &&
          options.systemPrompt !== "" && {
            system: options.systemPrompt,
          }),
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
      });

      return {
        content: extractText(message.content),
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        },
        finishReason: message.stop_reason ?? "",
      };
    } catch (error: unknown) {
      logger.error("Anthropic chat completion failed", {
        event: "ai_chat_failed",
        provider: "anthropic",
        model: options.model,
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("AI request failed via Anthropic");
    }
  }
}
