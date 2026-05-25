import OpenAI from "openai";
import { logger } from "../../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../../errors";
import { OPENAI_DEFAULT_BASE_URL } from "../../constants";
import type {
  AIProviderName,
  IAIChatOptions,
  IAIProvider,
  IAIResponse,
} from "../../types";
import type { IOpenAIProviderOptions } from "./openai.types";
import { toOpenAIMessages } from "./openai.utils";

/**
 * OpenAI Chat Completions client. Works against any provider that speaks
 * the OpenAI v1 wire format — point `baseURL` at OpenRouter, Ollama, vLLM,
 * Together, Groq, LM Studio, etc. and it just works.
 */
export class OpenAIProvider implements IAIProvider {
  public readonly providerName: AIProviderName = "openai";
  private readonly client: OpenAI;

  constructor(options: IOpenAIProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? OPENAI_DEFAULT_BASE_URL,
      ...(options.defaultHeaders !== undefined && {
        defaultHeaders: options.defaultHeaders,
      }),
    });
  }

  async chat(options: IAIChatOptions): Promise<IAIResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: options.model,
        messages: toOpenAIMessages(options),
        ...(options.maxTokens !== undefined && {
          max_completion_tokens: options.maxTokens,
        }),
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.responseFormat === "json" && {
          response_format: { type: "json_object" },
        }),
      });

      const choice = completion.choices[0];

      return {
        content: choice?.message.content ?? "",
        model: completion.model,
        ...(completion.usage && {
          usage: {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          },
        }),
        ...(choice?.finish_reason !== undefined && {
          finishReason: choice.finish_reason,
        }),
      };
    } catch (error: unknown) {
      logger.error("OpenAI chat completion failed", {
        event: "ai_chat_failed",
        provider: "openai",
        model: options.model,
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("AI request failed via OpenAI");
    }
  }
}
