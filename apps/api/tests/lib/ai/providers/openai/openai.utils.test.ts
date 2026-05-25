import { describe, expect, test } from "bun:test";

import { toOpenAIMessages } from "../../../../../src/lib/ai/providers/openai/openai.utils";

describe("toOpenAIMessages", () => {
  test("converts messages array, including system message when systemPrompt is set", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
      systemPrompt: "You are helpful",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.role).toBe("system");
    expect(result[0]?.content).toBe("You are helpful");
    expect(result[1]?.role).toBe("user");
    expect(result[1]?.content).toBe("Hello");
    expect(result[2]?.role).toBe("assistant");
    expect(result[2]?.content).toBe("Hi");
  });

  test("omits system message when systemPrompt is undefined", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("user");
  });

  test("omits system message when systemPrompt is empty string", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
      systemPrompt: "",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result).toHaveLength(1);
  });

  test("uses userMessage when messages array is not provided", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
      userMessage: "Single message",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("user");
    expect(result[0]?.content).toBe("Single message");
  });

  test("returns empty array when no messages are provided and systemPrompt is empty", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
    });

    expect(result).toEqual([]);
  });

  test("returns only system message when no conversation messages are given", () => {
    const result = toOpenAIMessages({
      model: "gpt-4o",
      systemPrompt: "You are helpful",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("system");
  });
});
