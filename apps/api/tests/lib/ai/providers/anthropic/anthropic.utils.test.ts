import { describe, expect, test } from "bun:test";

import {
  extractText,
  toAnthropicMessages,
} from "../../../../../src/lib/ai/providers/anthropic/anthropic.utils";
import type { IAnthropicContentBlock } from "../../../../../src/lib/ai/providers/anthropic/anthropic.types";

describe("toAnthropicMessages", () => {
  test("converts messages array, filtering out system role", () => {
    const result = toAnthropicMessages({
      model: "claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.role).toBe("user");
    expect(result[0]?.content).toBe("Hello");
    expect(result[1]?.role).toBe("assistant");
    expect(result[1]?.content).toBe("Hi there");
  });

  test("uses userMessage when messages array is not provided", () => {
    const result = toAnthropicMessages({
      model: "claude-sonnet-4-20250514",
      userMessage: "Single message",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("user");
    expect(result[0]?.content).toBe("Single message");
  });

  test("returns empty array when neither messages nor userMessage is provided", () => {
    const result = toAnthropicMessages({
      model: "claude-sonnet-4-20250514",
    });

    expect(result).toEqual([]);
  });

  test("ignores empty string userMessage", () => {
    const result = toAnthropicMessages({
      model: "claude-sonnet-4-20250514",
      userMessage: "",
    });

    expect(result).toEqual([]);
  });
});

describe("extractText", () => {
  test("joins text from multiple text blocks", () => {
    const blocks: IAnthropicContentBlock[] = [
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
    ];

    expect(extractText(blocks)).toBe("Hello world");
  });

  test("filters out non-text blocks", () => {
    const blocks: IAnthropicContentBlock[] = [
      { type: "tool_use" },
      { type: "text", text: "result" },
    ];

    expect(extractText(blocks)).toBe("result");
  });

  test("returns empty string for empty array", () => {
    expect(extractText([])).toBe("");
  });

  test("returns empty string when all blocks are non-text", () => {
    const blocks: IAnthropicContentBlock[] = [{ type: "tool_use" }];

    expect(extractText(blocks)).toBe("");
  });
});
