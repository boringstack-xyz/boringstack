import { describe, expect, test } from "bun:test";

import { markdown, parseTranscript, summarise } from "./run-report";

const result = {
  type: "result",
  num_turns: 12,
  total_cost_usd: 0.4321,
  duration_ms: 180_000,
  is_error: false,
  usage: {
    input_tokens: 1200,
    output_tokens: 300,
    cache_read_input_tokens: 9000,
    cache_creation_input_tokens: 40,
  },
  permission_denials: [
    { tool_name: "Bash", tool_input: { command: "rm -rf /tmp/x" } },
  ],
  result: "Opened the fix.",
};

describe("agent run transcripts", () => {
  test("reads a JSON array and JSON lines alike, skipping lines that do not parse", () => {
    expect(
      parseTranscript(JSON.stringify([{ type: "assistant" }, result]))
    ).toHaveLength(2);
    expect(
      parseTranscript(
        `${JSON.stringify({ type: "assistant" })}\nnot json\n${JSON.stringify(result)}`
      )
    ).toHaveLength(2);
  });

  test("summarises turns, cost, tokens and the final message from the result message", () => {
    const summary = summarise([{ type: "assistant" }, result]);

    expect(summary.turns).toBe(12);
    expect(summary.minutes).toBe(3);
    expect(summary.tokens.cacheRead).toBe(9000);
    expect(summary.final).toBe("Opened the fix.");
    expect(summary.denials).toEqual(["Bash: rm -rf /tmp/x"]);
  });

  test("the Markdown names refused tool calls and has no empty sections", () => {
    const text = markdown("Triage run", summarise([result]));

    expect(text).toContain("### Triage run");
    expect(text).toContain("Refused tool calls (1)");
    expect(text).toContain("- `Bash: rm -rf /tmp/x`");
    expect(markdown("Empty", summarise([]))).not.toContain("Refused");
  });
});
