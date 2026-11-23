export interface IOpenRouterOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** OpenRouter provider policy: whether providers may train on prompts. */
  readonly dataCollection: "allow" | "deny";
  readonly referer?: string;
  readonly title?: string;
}

/** Partial tool call as it arrives across stream chunks. */
export interface IToolCallDraft {
  id: string;
  name: string;
  arguments: string;
}

export interface ISseParse {
  readonly payloads: readonly string[];
  /** Unfinished bytes carried into the next read. */
  readonly rest: string;
}
