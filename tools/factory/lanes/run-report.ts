/*
 * Summarises an agent run from its execution transcript (a JSON array, or one
 * JSON message per line): turns, cost, tokens, every tool call the permission
 * rules refused, and the final message. Written to the job summary so a run
 * that stopped early says why. Tool inputs are commands and paths, not secrets.
 */
import { readFileSync } from "node:fs";

import { isRecord } from "../state";

export interface IRunSummary {
  readonly turns: number | undefined;
  readonly costUsd: number;
  readonly minutes: number | undefined;
  readonly tokens: {
    readonly input: number;
    readonly output: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
  };
  readonly isError: boolean;
  readonly denials: readonly string[];
  readonly final: string;
}

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** A transcript's messages: a JSON array, or JSON lines. Lines that do not parse are skipped. */
export const parseTranscript = (raw: string): unknown[] => {
  const text = raw.trim();

  if (text.startsWith("[")) {
    const parsed: unknown = JSON.parse(text);

    return Array.isArray(parsed) ? parsed : [];
  }

  return text.split("\n").flatMap((line) => {
    try {
      const value: unknown = JSON.parse(line);

      return [value];
    } catch {
      return [];
    }
  });
};

export const summarise = (messages: readonly unknown[]): IRunSummary => {
  const result =
    [...messages]
      .reverse()
      .find(
        (message): message is Record<string, unknown> =>
          isRecord(message) && message.type === "result"
      ) ?? {};
  const usage = isRecord(result.usage) ? result.usage : {};
  const denials = Array.isArray(result.permission_denials)
    ? result.permission_denials.filter(isRecord)
    : [];
  const duration = num(result.duration_ms);

  return {
    turns: typeof result.num_turns === "number" ? result.num_turns : undefined,
    costUsd: num(result.total_cost_usd),
    minutes: duration > 0 ? Math.round(duration / 60_000) : undefined,
    tokens: {
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
      cacheWrite: num(usage.cache_creation_input_tokens),
    },
    isError: result.is_error === true,
    denials: denials.map((denial) => {
      const input = isRecord(denial.tool_input) ? denial.tool_input : {};
      const detail =
        input.command ??
        input.file_path ??
        input.url ??
        input.pattern ??
        JSON.stringify(input);

      return `${String(denial.tool_name)}: ${(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300)}`;
    }),
    final: typeof result.result === "string" ? result.result : "",
  };
};

const fmt = (value: number): string => value.toLocaleString("en-US");

export const markdown = (title: string, summary: IRunSummary): string => {
  const lines = [
    `### ${title}`,
    "",
    `Turns: ${summary.turns === undefined ? "?" : String(summary.turns)}, cost: $${summary.costUsd.toFixed(2)}, error: ${summary.isError ? "yes" : "no"}`,
    `Time: ${summary.minutes === undefined ? "?" : String(summary.minutes)} min. Tokens: ${fmt(summary.tokens.input)} in, ${fmt(summary.tokens.output)} out, ${fmt(summary.tokens.cacheRead)} cache read, ${fmt(summary.tokens.cacheWrite)} cache write.`,
  ];

  if (summary.denials.length > 0) {
    lines.push(
      "",
      `Refused tool calls (${String(summary.denials.length)}); allow the command in the agent's tool list if the run needs it:`,
      "",
      ...summary.denials.map((denial) => `- \`${denial.replaceAll("`", "'")}\``)
    );
  }

  if (summary.final !== "") {
    lines.push("", "Final message:", "", summary.final.slice(0, 4000));
  }

  return `${lines.join("\n")}\n`;
};

/** Reads a transcript file and renders its summary; a missing file says so. */
export const reportOf = (file: string, title: string): string => {
  let raw: string;

  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return `### ${title}\n\nNo execution file.\n`;
  }

  return markdown(title, summarise(parseTranscript(raw)));
};
