import { streamBudget } from "./openrouter.budget";
import { logger } from "../../../../config/logger";
import { ApiErrors, getErrorMessage } from "../../../errors";
import type {
  IAIStreamEvent,
  IStreamRequest,
  IStreamingAIProvider,
} from "../../stream.types";
import type { IOpenRouterOptions, IToolCallDraft } from "./openrouter.types";
import {
  StreamChunkError,
  chunkEvents,
  parseSse,
  requestBody,
} from "./openrouter.utils";

/**
 * OpenRouter chat completions over native fetch streaming. The key is
 * sent only in the Authorization header and never logged.
 */
export class OpenRouterProvider implements IStreamingAIProvider {
  public readonly providerName = "openrouter" as const;

  public constructor(private readonly options: IOpenRouterOptions) {}

  public async quote(
    models: readonly string[],
    outputTokens: number,
    calls: number,
    inputTokens: number
  ) {
    const response = await fetch(`${this.options.baseUrl}/models`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });

    if (!response.ok) {
      throw ApiErrors.externalService("Model pricing is unavailable");
    }

    return streamBudget(
      await response.json(),
      models,
      outputTokens,
      calls,
      inputTokens
    );
  }

  public async *stream(request: IStreamRequest): AsyncIterable<IAIStreamEvent> {
    const response = await this.open(request);
    const body = response.body;

    if (body === null) {
      throw ApiErrors.externalService("The AI provider returned no stream");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    const drafts = new Map<number, IToolCallDraft>();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);

        buffer = parsed.rest;

        for (const payload of parsed.payloads) {
          if (payload === "[DONE]") {
            return;
          }

          yield* chunkEvents(this.parse(payload), drafts);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parse(payload: string): unknown {
    try {
      return JSON.parse(payload);
    } catch {
      throw new StreamChunkError("Malformed stream chunk");
    }
  }

  private async open(request: IStreamRequest): Promise<Response> {
    let response: Response;

    try {
      if (request.budget === undefined) {
        throw ApiErrors.externalService("A spending reservation is required");
      }

      const body = JSON.stringify(requestBody(request, this.options));

      request.signal.throwIfAborted();
      request.onDispatch?.();
      response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        signal: request.signal,
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          ...(this.options.referer !== undefined && {
            "HTTP-Referer": this.options.referer,
          }),
          ...(this.options.title !== undefined && {
            "X-Title": this.options.title,
          }),
        },
        body,
      });
    } catch (error: unknown) {
      logger.warn("OpenRouter request failed", {
        event: "ai_stream_failed",
        provider: "openrouter",
        error: getErrorMessage(error),
      });

      throw ApiErrors.externalService("The AI provider is unavailable");
    }

    if (!response.ok) {
      logger.warn("OpenRouter refused the request", {
        event: "ai_stream_failed",
        provider: "openrouter",
        status: response.status,
      });

      throw ApiErrors.externalService("The AI provider is unavailable");
    }

    return response;
  }
}
