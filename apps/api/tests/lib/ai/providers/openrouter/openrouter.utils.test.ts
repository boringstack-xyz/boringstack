import { describe, expect, test } from "bun:test";

import {
  StreamChunkError,
  chunkEvents,
  parseSse,
  requestBody,
} from "../../../../../src/lib/ai/providers/openrouter";
import type { IToolCallDraft } from "../../../../../src/lib/ai/providers/openrouter/openrouter.types";

describe("parseSse", () => {
  test("drops comments, keeps data payloads and carries a partial event", () => {
    const parsed = parseSse(
      ': OPENROUTER PROCESSING\n\ndata: {"a":1}\n\ndata: {"b"'
    );

    expect(parsed.payloads).toEqual(['{"a":1}']);
    expect(parsed.rest).toBe('data: {"b"');
    expect(parseSse("data: [DONE]\r\n\r\n").payloads).toEqual(["[DONE]"]);
  });
});

describe("chunkEvents", () => {
  test("assembles a tool call split across chunks and emits it on finish", () => {
    const drafts = new Map<number, IToolCallDraft>();
    const first = chunkEvents(
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: { name: "highlight", arguments: '{"ids":' },
                },
              ],
            },
          },
        ],
      },
      drafts
    );
    const second = chunkEvents(
      {
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '["p1"]}' } }],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
      drafts
    );

    expect(first).toEqual([]);
    expect(second).toEqual([
      {
        type: "tool_call",
        call: { id: "call_1", name: "highlight", arguments: '{"ids":["p1"]}' },
      },
      { type: "finish", reason: "tool_calls" },
    ]);
  });

  test("reports text deltas and the final usage with cost", () => {
    const drafts = new Map<number, IToolCallDraft>();

    expect(
      chunkEvents({ choices: [{ delta: { content: "Lug 3" } }] }, drafts)
    ).toEqual([{ type: "text", delta: "Lug 3" }]);
    expect(
      chunkEvents(
        {
          model: "openai/gpt-5-mini",
          choices: [],
          usage: { prompt_tokens: 900, completion_tokens: 40, cost: 0.00031 },
        },
        drafts
      )
    ).toEqual([
      {
        type: "usage",
        model: "openai/gpt-5-mini",
        usage: { inputTokens: 900, outputTokens: 40, costUsd: 0.00031 },
      },
    ]);
  });

  test("raises on a provider error or a malformed chunk", () => {
    const drafts = new Map<number, IToolCallDraft>();

    expect(() =>
      chunkEvents({ error: { message: "Rate limited" } }, drafts)
    ).toThrow(StreamChunkError);
    expect(() => chunkEvents("nonsense", drafts)).toThrow(StreamChunkError);
  });
});

describe("requestBody", () => {
  test("sends fallbacks, tools and the provider data policy", () => {
    const body = requestBody(
      {
        models: ["a/one", "b/two"],
        messages: [
          { role: "system", content: "sys" },
          {
            role: "assistant",
            content: "",
            toolCalls: [{ id: "c1", name: "inspect_step", arguments: "{}" }],
          },
          { role: "tool", toolCallId: "c1", content: "{}" },
        ],
        tools: [{ name: "inspect_step", description: "d", parameters: {} }],
        maxOutputTokens: 500,
        signal: new AbortController().signal,
      },
      { dataCollection: "deny" }
    );

    expect(body).toMatchObject({
      model: "a/one",
      models: ["a/one", "b/two"],
      stream: true,
      max_tokens: 500,
      tool_choice: "auto",
      provider: {
        require_parameters: true,
        data_collection: "deny",
        sort: "throughput",
      },
    });
    expect(JSON.stringify(body)).toContain('"tool_call_id":"c1"');
  });
});

describe("requestBody with a photo", () => {
  test("sends a user message's photo as an image part after its words", () => {
    const body = requestBody(
      {
        models: ["vision/model"],
        messages: [
          {
            role: "user",
            content: "Is this joint good?",
            images: [{ mediaType: "image/jpeg", data: "/9j/4AAQ" }],
          },
        ],
        tools: [],
        maxOutputTokens: 100,
        signal: new AbortController().signal,
      },
      { dataCollection: "deny" }
    );

    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "Is this joint good?" },
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,/9j/4AAQ" },
          },
        ],
      },
    ]);
  });
});
