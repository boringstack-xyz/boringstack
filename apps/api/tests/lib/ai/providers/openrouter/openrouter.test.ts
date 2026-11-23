import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { logger } from "../../../../../src/config/logger";
import { OpenRouterProvider } from "../../../../../src/lib/ai/providers/openrouter";
import type { IAIStreamEvent } from "../../../../../src/lib/ai/stream.types";

const KEY = "sk-or-test-secret-value";
const originalFetch = globalThis.fetch;

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }

        controller.close();
      },
    }),
    { status: 200 }
  );
}

const provider = () =>
  new OpenRouterProvider({
    apiKey: KEY,
    baseUrl: "https://openrouter.example/api/v1",
    dataCollection: "deny",
  });

const request = () => ({
  budget: { reserveUsd: 0.05, promptPerMillion: 1, completionPerMillion: 2 },
  models: ["a/one"],
  messages: [{ role: "user" as const, content: "hi" }],
  tools: [],
  maxOutputTokens: 100,
  signal: new AbortController().signal,
});

async function collect(stream: AsyncIterable<IAIStreamEvent>) {
  const events: IAIStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

/** The error message a promise rejects with, or "" when it resolves. */
const failure = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => "",
    (error: unknown) =>
      error instanceof Error ? error.message : "non-error rejection"
  );

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("OpenRouterProvider", () => {
  test("streams text split mid-event and stops at [DONE]", async () => {
    let seenAuth = "";

    globalThis.fetch = Object.assign(
      (_input: unknown, init?: RequestInit) => {
        seenAuth = new Headers(init?.headers).get("Authorization") ?? "";

        return Promise.resolve(
          sseResponse([
            ': OPENROUTER PROCESSING\n\ndata: {"choices":[{"delta":{"content":"Hel',
            'lo"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"cost":0.0001}}\n\n',
            'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"late"}}]}\n\n',
          ])
        );
      },
      { preconnect: originalFetch.preconnect }
    );

    const events = await collect(provider().stream(request()));

    expect(seenAuth).toBe(`Bearer ${KEY}`);
    expect(events).toEqual([
      { type: "text", delta: "Hello" },
      { type: "finish", reason: "stop" },
      {
        type: "usage",
        model: "",
        usage: { inputTokens: 3, outputTokens: 1, costUsd: 0.0001 },
      },
    ]);
  });

  test("fails closed on a refused request without logging the key", async () => {
    const warn = spyOn(logger, "warn");

    globalThis.fetch = Object.assign(
      () => Promise.resolve(new Response("nope", { status: 503 })),
      { preconnect: originalFetch.preconnect }
    );

    const error = await failure(collect(provider().stream(request())));

    expect(error).toContain("The AI provider is unavailable");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
    warn.mockRestore();
  });

  test("raises on a malformed chunk", async () => {
    globalThis.fetch = Object.assign(
      () => Promise.resolve(sseResponse(["data: {not json}\n\n"])),
      { preconnect: originalFetch.preconnect }
    );

    expect(await failure(collect(provider().stream(request())))).toContain(
      "Malformed stream chunk"
    );
  });
});

test("an already cancelled request is never dispatched", async () => {
  const controller = new AbortController();

  controller.abort();
  let dispatched = false;

  expect(
    await failure(
      collect(
        provider().stream({
          ...request(),
          signal: controller.signal,
          onDispatch: () => {
            dispatched = true;
          },
        })
      )
    )
  ).not.toBe("");
  expect(dispatched).toBe(false);
});

test("does not dispatch paid requests without a quoted budget", async () => {
  let dispatched = false;

  globalThis.fetch = Object.assign(
    () => {
      dispatched = true;

      return Promise.resolve(sseResponse([]));
    },
    { preconnect: originalFetch.preconnect }
  );
  const { budget: _budget, ...unpriced } = request();

  expect(await failure(collect(provider().stream(unpriced)))).not.toBe("");
  expect(dispatched).toBe(false);
});
