#!/usr/bin/env bun
/*
 * One-command opt-in for the spec loop. Three things get wired so the
 * forker doesn't have to copy files by hand:
 *
 *   1. `.specs/next.md` — the live spec, copied from the vendored
 *      template at tools/spec-loop/templates/next.md.
 *   2. `.claude/commands/spec.md` — the slash command, copied from
 *      tools/spec-loop/commands/spec.md so /spec works in this project.
 *   3. `.claude/settings.json` + `.cursor/hooks.json` — PreToolUse hook
 *      that runs `bun tools/spec-loop/hooks/gate.ts` and blocks source
 *      writes until the current slice is approved.
 *
 * Idempotent: refuses to overwrite an existing artifact unless --force
 * is passed. Prints a one-liner explaining what was created and what
 * the next step is.
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const REPO_ROOT = process.cwd();
const FORCE = process.argv.includes("--force");

interface IPlan {
  source: string | (() => string);
  destination: string;
  kind: "copy" | "merge-json";
}

const C_RESET = "[0m";
const C_CYAN = "[36m";
const C_GREEN = "[32m";
const C_YELLOW = "[33m";
const C_RED = "[31m";

function step(message: string): void {
  process.stdout.write(`${C_CYAN}▶${C_RESET} ${message}\n`);
}

function ok(message: string): void {
  process.stdout.write(`${C_GREEN}✓${C_RESET} ${message}\n`);
}

function skipped(message: string): void {
  process.stdout.write(`${C_YELLOW}·${C_RESET} ${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${C_RED}✗${C_RESET} ${message}\n`);
  process.exit(1);
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeIfMissing(
  destination: string,
  produce: () => string
): "wrote" | "skipped" {
  if (existsSync(destination) && !FORCE) {
    return "skipped";
  }
  ensureDir(dirname(destination));
  writeFileSync(destination, produce());

  return "wrote";
}

function copyIfMissing(source: string, destination: string): "wrote" | "skipped" {
  if (existsSync(destination) && !FORCE) {
    return "skipped";
  }
  ensureDir(dirname(destination));
  copyFileSync(source, destination);

  return "wrote";
}

/*
 * Hook payloads for Claude Code (settings.json) and Cursor
 * (.cursor/hooks.json). Both shell out to the same TypeScript gate so
 * there is only one source of truth for the decision logic.
 *
 * Claude Code's PreToolUse contract: stdin is JSON, stdout is JSON with
 * `decision: "approve" | "block"` and an optional `reason`. Cursor's
 * v1 hook format is structurally similar; the same gate works.
 */
function claudeSettings(): string {
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          hooks: [
            {
              type: "command",
              command: "bun tools/spec-loop/hooks/gate.ts"
            }
          ]
        }
      ]
    }
  };

  return JSON.stringify(settings, null, 2) + "\n";
}

function cursorHooks(): string {
  const hooks = {
    version: 1,
    hooks: {
      preToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          command: "bun tools/spec-loop/hooks/gate.ts"
        }
      ]
    }
  };

  return JSON.stringify(hooks, null, 2) + "\n";
}

/*
 * Merge Claude Code's settings.json instead of clobbering: a forker may
 * already have a custom matcher, a different permission set, or a
 * different model alias. We only add the PreToolUse entry that points
 * at our gate, and only if no entry already references it.
 */
function mergeClaudeSettings(existing: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(existing);
  } catch {
    fail(
      `.claude/settings.json is not valid JSON; refusing to merge automatically. Fix or delete the file and re-run.`
    );
  }
  const hooks = (parsed.hooks ??= {}) as Record<string, unknown>;
  const pre = (hooks.PreToolUse ??= []) as unknown[];
  const alreadyWired = pre.some((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }
    const candidate = entry as { hooks?: unknown[] };

    return (
      Array.isArray(candidate.hooks) &&
      candidate.hooks.some((inner) => {
        if (typeof inner !== "object" || inner === null) {
          return false;
        }
        const command = (inner as { command?: unknown }).command;

        return (
          typeof command === "string" && command.includes("tools/spec-loop/hooks/gate")
        );
      })
    );
  });

  if (alreadyWired) {
    return existing;
  }

  pre.push({
    matcher: "Write|Edit|MultiEdit",
    hooks: [
      {
        type: "command",
        command: "bun tools/spec-loop/hooks/gate.ts"
      }
    ]
  });

  return JSON.stringify(parsed, null, 2) + "\n";
}

const PLAN: IPlan[] = [
  {
    source: join(REPO_ROOT, "tools/spec-loop/templates/next.md"),
    destination: join(REPO_ROOT, ".specs/next.md"),
    kind: "copy"
  },
  {
    source: join(REPO_ROOT, "tools/spec-loop/commands/spec.md"),
    destination: join(REPO_ROOT, ".claude/commands/spec.md"),
    kind: "copy"
  },
  {
    source: claudeSettings,
    destination: join(REPO_ROOT, ".claude/settings.json"),
    kind: "merge-json"
  },
  {
    source: cursorHooks,
    destination: join(REPO_ROOT, ".cursor/hooks.json"),
    kind: "copy"
  }
];

function preflight(): void {
  if (!existsSync(join(REPO_ROOT, "tools/spec-loop/templates/next.md"))) {
    fail(
      `tools/spec-loop/templates/next.md is missing — is this a BoringStack checkout?`
    );
  }
}

function run(): void {
  step("Wiring the spec loop into this project");
  preflight();

  for (const item of PLAN) {
    const dest = relative(REPO_ROOT, item.destination);

    if (item.kind === "copy") {
      const source = typeof item.source === "function" ? null : item.source;
      const produce =
        typeof item.source === "function"
          ? item.source
          : () => readFileSync(source!, "utf8");
      const outcome = writeIfMissing(item.destination, produce);

      if (outcome === "wrote") {
        ok(`wrote ${dest}`);
      } else {
        skipped(`${dest} already exists (use --force to overwrite)`);
      }
      continue;
    }

    if (item.kind === "merge-json") {
      if (typeof item.source !== "function") {
        fail(`merge-json target needs a producer function`);
      }
      if (existsSync(item.destination)) {
        const current = readFileSync(item.destination, "utf8");
        const merged = mergeClaudeSettings(current);

        if (merged === current) {
          skipped(`${dest} already wires the spec gate`);
        } else {
          ensureDir(dirname(item.destination));
          writeFileSync(item.destination, merged);
          ok(`merged spec-gate hook into ${dest}`);
        }
      } else {
        ensureDir(dirname(item.destination));
        writeFileSync(item.destination, item.source());
        ok(`wrote ${dest}`);
      }
    }
  }

  process.stdout.write(`\n`);
  ok("Spec loop is active in this project.");
  process.stdout.write(
    `\nNext: open \`.specs/next.md\`, then in Claude Code or Cursor run\n  ${C_CYAN}/spec explore <your idea>${C_RESET}\n  → ${C_CYAN}/spec slice${C_RESET}\n  → ${C_CYAN}/spec approve${C_RESET} (you, not the agent)\n  → ${C_CYAN}/spec build${C_RESET}\n\nThe gate at tools/spec-loop/hooks/gate.ts blocks source writes until\n\`.specs/next.md\` has \`status: approved\` in its frontmatter.\n`
  );
}

run();
