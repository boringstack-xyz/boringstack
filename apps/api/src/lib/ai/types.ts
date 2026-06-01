export type AIProviderName = "openai" | "anthropic" | "noop";

export interface IChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface IAIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface IAIChatOptions {
  /** Model id (e.g. "gpt-4o-mini", "claude-haiku-4-5"). Required. */
  model: string;
  systemPrompt?: string;
  /** Convenience for single-shot prompts. Mutually optional with `messages`. */
  userMessage?: string;
  /** Full multi-turn history. Wins over `userMessage` if both are passed. */
  messages?: IChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a JSON-shaped response. Best-effort by provider. */
  responseFormat?: "json" | "text";
}

export interface IAIResponse {
  content: string;
  model: string;
  usage?: IAIUsage;
  finishReason?: string;
}

export interface IAIProvider {
  /** Identifies which provider is active (for logging / health checks). */
  readonly providerName: AIProviderName;
  chat: (options: IAIChatOptions) => Promise<IAIResponse>;
}
