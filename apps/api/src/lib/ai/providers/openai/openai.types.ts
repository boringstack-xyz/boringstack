export type OpenAIRole = "system" | "user" | "assistant";

export interface IOpenAIMessage {
  role: OpenAIRole;
  content: string;
}

export interface IOpenAIProviderOptions {
  apiKey: string;
  /**
   * Override to point at any OpenAI-compatible endpoint:
   *   - OpenAI:       https://api.openai.com/v1   (default)
   *   - OpenRouter:   https://openrouter.ai/api/v1
   *   - Ollama:       http://localhost:11434/v1
   *   - LM Studio:    http://localhost:1234/v1
   *   - vLLM / TGI:   http://localhost:8000/v1
   *   - Together:     https://api.together.xyz/v1
   *   - Groq:         https://api.groq.com/openai/v1
   */
  baseURL?: string;
  /**
   * Extra headers sent on every request. Useful for OpenRouter ranking
   * (`HTTP-Referer`, `X-Title`) or any custom-gateway auth.
   */
  defaultHeaders?: Record<string, string>;
}
