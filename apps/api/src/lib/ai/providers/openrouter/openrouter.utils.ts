import type {
  IAIStreamEvent,
  IStreamMessage,
  IStreamRequest,
} from "../../stream.types";
import type {
  IOpenRouterOptions,
  ISseParse,
  IToolCallDraft,
} from "./openrouter.types";

/**
 * Splits SSE text into `data:` payloads. Comment lines (": OPENROUTER
 * PROCESSING") and other fields are dropped; an incomplete trailing event
 * is returned as `rest` for the next chunk.
 */
export function parseSse(buffer: string): ISseParse {
  const normalised = buffer.replace(/\r\n/g, "\n");
  const boundary = normalised.lastIndexOf("\n\n");

  if (boundary === -1) {
    return { payloads: [], rest: normalised };
  }

  const complete = normalised.slice(0, boundary);
  const payloads = complete
    .split("\n\n")
    .map((event) =>
      event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
    )
    .filter((payload) => payload !== "");

  return { payloads, rest: normalised.slice(boundary + 2) };
}

const toWireMessage = (message: IStreamMessage): Record<string, unknown> => {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }

  if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: (message.toolCalls ?? []).map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }

  if (message.role === "user" && (message.images?.length ?? 0) > 0) {
    return {
      role: "user",
      content: [
        { type: "text", text: message.content },
        ...(message.images ?? []).map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mediaType};base64,${image.data}` },
        })),
      ],
    };
  }

  return { role: message.role, content: message.content };
};

/**
 * OpenAI-compatible body with OpenRouter routing: model fallbacks, only
 * providers that support every parameter sent (tools), the configured
 * data-collection policy, and the fastest of those hosts first. Usage and cost are always returned by OpenRouter.
 */
export function requestBody(
  request: IStreamRequest,
  options: Pick<IOpenRouterOptions, "dataCollection">
): Record<string, unknown> {
  const [model, ...fallbacks] = request.models;

  return {
    model,
    ...(fallbacks.length > 0 && { models: [...request.models] }),
    stream: true,
    max_tokens: request.maxOutputTokens,
    messages: request.messages.map(toWireMessage),
    ...(request.tools.length > 0 && {
      tools: request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: "auto",
    }),
    /*
     * The fastest host, at whatever it charges: the cheapest crawls and a
     * turn has two minutes. Cost tuning waits for paying users.
     */
    provider: {
      require_parameters: true,
      data_collection: options.dataCollection,
      allow_fallbacks: true,
      sort: "throughput",
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const recordAt = (
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null => {
  const child = value[key];

  return isRecord(child) ? child : null;
};

function mergeToolDeltas(
  drafts: Map<number, IToolCallDraft>,
  deltas: unknown
): void {
  if (!Array.isArray(deltas)) {
    return;
  }

  for (const delta of deltas) {
    if (!isRecord(delta)) {
      continue;
    }

    const index = numberOr(delta.index, drafts.size);
    const draft = drafts.get(index) ?? { id: "", name: "", arguments: "" };
    const fn = recordAt(delta, "function");

    if (typeof delta.id === "string") {
      draft.id = delta.id;
    }

    if (fn !== null && typeof fn.name === "string") {
      draft.name += fn.name;
    }

    if (fn !== null && typeof fn.arguments === "string") {
      draft.arguments += fn.arguments;
    }

    drafts.set(index, draft);
  }
}

/** Stream-level failure OpenRouter reports inside a chunk. */
export class StreamChunkError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "StreamChunkError";
  }
}

function choiceEvents(
  choice: unknown,
  drafts: Map<number, IToolCallDraft>
): IAIStreamEvent[] {
  if (!isRecord(choice)) {
    return [];
  }

  const events: IAIStreamEvent[] = [];
  const delta = recordAt(choice, "delta");
  const content = delta?.content;

  if (typeof content === "string" && content !== "") {
    events.push({ type: "text", delta: content });
  }

  mergeToolDeltas(drafts, delta?.tool_calls);

  if (typeof choice.finish_reason !== "string") {
    return events;
  }

  for (const draft of drafts.values()) {
    if (draft.name !== "") {
      events.push({ type: "tool_call", call: { ...draft } });
    }
  }

  drafts.clear();
  events.push({ type: "finish", reason: choice.finish_reason });

  return events;
}

/**
 * Turns one parsed chunk into events. Tool call fragments accumulate in
 * `drafts` and are emitted whole when the choice finishes.
 */
export function chunkEvents(
  chunk: unknown,
  drafts: Map<number, IToolCallDraft>
): IAIStreamEvent[] {
  if (!isRecord(chunk)) {
    throw new StreamChunkError("Malformed stream chunk");
  }

  const error = recordAt(chunk, "error");

  if (error !== null) {
    throw new StreamChunkError(
      typeof error.message === "string" ? error.message : "Provider error"
    );
  }

  const choices: unknown[] = Array.isArray(chunk.choices) ? chunk.choices : [];
  const events = choiceEvents(choices[0], drafts);
  const usage = recordAt(chunk, "usage");

  if (usage !== null) {
    events.push({
      type: "usage",
      model: typeof chunk.model === "string" ? chunk.model : "",
      usage: {
        inputTokens: numberOr(usage.prompt_tokens, 0),
        outputTokens: numberOr(usage.completion_tokens, 0),
        costUsd:
          typeof usage.cost === "number" &&
          Number.isFinite(usage.cost) &&
          usage.cost >= 0
            ? usage.cost
            : null,
      },
    });
  }

  return events;
}
