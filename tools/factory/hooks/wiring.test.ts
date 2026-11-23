import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../context";
import { hookCommands } from ".";

/* The harness configs must call hooks this CLI has, for the same events. */
const commandsIn = (file: string): string[] =>
  [
    ...readFileSync(join(repoRoot(), file), "utf8").matchAll(
      /tools\/factory\/cli\.ts\\?" hook (\w+)/gu
    ),
  ].map((match) => `hook ${match[1] ?? ""}`);

describe("hook wiring", () => {
  test("Claude Code and Codex wire the same hooks, and every one exists", () => {
    const known = hookCommands.map((command) => command.name);
    const claude = commandsIn(".claude/settings.json");
    const codex = commandsIn(".codex/hooks.json");

    expect(claude.sort()).toEqual([...known].sort());
    expect(codex.sort()).toEqual(claude.sort());
  });
});
