/*
 * Streaming chat with tools. Kept apart from `IAIProvider.chat()` so the
 * single-shot callers keep their shape; a product opts in by building a
 * streaming provider (see `stream-provider.ts`).
 */
export interface IToolDefinition {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the arguments object. */
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface IToolCall {
  readonly id: string;
  readonly name: string;
  /** Raw JSON text as the model produced it; validated by the caller. */
  readonly arguments: string;
}

/** A JPEG sent with a user message; the streaming providers accept only JPEG. */
export interface IStreamImage {
  readonly mediaType: "image/jpeg";
  /** Base64, without the data URL prefix. */
  readonly data: string;
}

export type IStreamMessage =
  | { readonly role: "system"; readonly content: string }
  | {
      readonly role: "user";
      readonly content: string;
      readonly images?: readonly IStreamImage[];
    }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly IToolCall[];
    }
  | {
      readonly role: "tool";
      readonly toolCallId: string;
      readonly content: string;
    };

/**
 * Price and reservation for one turn, quoted before any paid request is
 * dispatched. `reserveUsd` is the most the turn may cost; the provider
 * refuses to dispatch without it.
 */
export interface IStreamBudget {
  readonly reserveUsd: number;
  readonly promptPerMillion: number;
  readonly completionPerMillion: number;
}

export interface IStreamRequest {
  readonly budget?: IStreamBudget;
  /** Ordered candidates; the provider may fall back down the list. */
  readonly models: readonly string[];
  readonly messages: readonly IStreamMessage[];
  readonly tools: readonly IToolDefinition[];
  readonly maxOutputTokens: number;
  readonly signal: AbortSignal;
  /** Called immediately before dispatch; ambiguous network failures may be charged. */
  readonly onDispatch?: () => void;
}

export interface IStreamUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider-reported charge in USD; null when the provider gave none. */
  readonly costUsd: number | null;
}

export type IAIStreamEvent =
  | { readonly type: "text"; readonly delta: string }
  | { readonly type: "tool_call"; readonly call: IToolCall }
  | {
      readonly type: "usage";
      readonly model: string;
      readonly usage: IStreamUsage;
    }
  | { readonly type: "finish"; readonly reason: string };

export interface IStreamingAIProvider {
  readonly providerName: "openrouter" | "fake";
  quote?: (
    models: readonly string[],
    outputTokens: number,
    calls: number,
    inputTokens: number
  ) => Promise<IStreamBudget>;
  stream: (request: IStreamRequest) => AsyncIterable<IAIStreamEvent>;
}
