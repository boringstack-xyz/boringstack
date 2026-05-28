#!/usr/bin/env bun
/*
 * PreToolUse gate for the Solo Spec Loop, rewritten in TypeScript so a
 * BoringStack fork does not need Python on the dev machine. Mirrors the
 * stdlib-only Python original at solo_spec_gate.py 1:1:
 *
 *   - Walk up from cwd looking for `.specs/next.md`. Stop at the first
 *     `.git/` directory (project ceiling) or at filesystem root.
 *   - No spec → project hasn't opted in → allow silently.
 *   - Spec found:
 *       - allow non-source writes (specs, tests, docs, .claude, .cursor, etc.).
 *       - block source writes when the spec exceeds the line cap.
 *       - block source writes unless frontmatter contains `status: approved`.
 *
 * Reads the hook payload from stdin, writes a JSON decision to stdout,
 * exits 0 either way. Failures fail open with a reason — never lock the
 * user out because of a parse error.
 *
 * Tests live next to the Python original; this file's behavior is
 * verified by the same fixtures via the runtime equivalence test.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, sep, relative, isAbsolute, join, extname, posix } from "node:path";

const ALWAYS_ALLOW_PREFIXES = [
  ".specs/",
  ".claude/",
  ".cursor/",
  "docs/",
  "README",
  "CHANGELOG",
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md"
] as const;

const TEST_PATTERNS = [
  /(^|\/)tests?\//i,
  /(^|\/)__tests__\//i,
  /(^|\/)e2e\//i,
  /\.test\./i,
  /\.spec\./i
];

const SOURCE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".vue",
  ".svelte",
  ".sql"
]);

// Target is 90, soft warning 120, hard stop here.
const MAX_SPEC_LINES = 140;

// `status: approved` must be a line on its own, anywhere in frontmatter
// (matches `^[ \t]*status:[ \t]*approved[ \t]*$` multiline).
const APPROVAL_RE = /^[ \t]*status:[ \t]*approved[ \t]*$/m;

// Frontmatter fence: optional leading whitespace tolerated; first `---`
// at file start, second `---` closes the block.
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function dirExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function findSpec(start: string): string | null {
  let current = resolve(start);
  for (;;) {
    const spec = join(current, ".specs", "next.md");
    if (fileExists(spec)) {
      return spec;
    }
    if (dirExists(join(current, ".git"))) {
      return null;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function projectRootFor(spec: string): string {
  return dirname(dirname(spec));
}

function normalize(rawPath: string, root: string): string {
  const expanded = rawPath.startsWith("~")
    ? rawPath.replace(/^~/, process.env.HOME ?? "~")
    : rawPath;
  const abs = isAbsolute(expanded) ? expanded : resolve(root, expanded);
  const rel = relative(resolve(root), resolve(abs));
  return rel.split(sep).join(posix.sep);
}

function extractPaths(payload: unknown, root: string): string[] {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }
  const toolInput =
    "tool_input" in payload &&
    typeof (payload as { tool_input?: unknown }).tool_input === "object" &&
    (payload as { tool_input?: unknown }).tool_input !== null
      ? ((payload as { tool_input?: Record<string, unknown> }).tool_input ?? {})
      : {};
  const paths: string[] = [];
  for (const key of ["file_path", "path"] as const) {
    const value = toolInput[key];
    if (typeof value === "string" && value.length > 0) {
      paths.push(normalize(value, root));
    }
  }
  return [...new Set(paths)].sort();
}

function isTest(path: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(path));
}

function isAllowedBeforeApproval(path: string): boolean {
  return (
    ALWAYS_ALLOW_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    isTest(path)
  );
}

function isSource(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(path)) && !isAllowedBeforeApproval(path);
}

function isApproved(text: string): boolean {
  const match = FRONTMATTER_RE.exec(text);
  const haystack = match?.[1] ?? text;
  return APPROVAL_RE.test(haystack);
}

function emit(decision: "approve" | "block", reason?: string): never {
  const out: { decision: string; reason?: string } = { decision };
  if (reason !== undefined && reason !== "") {
    out.reason = reason;
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

function allow(reason?: string): never {
  emit("approve", reason);
}

function block(reason: string): never {
  emit("block", reason);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<never> {
  let payload: unknown;
  try {
    const raw = await readStdin();
    payload = raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    allow("No hook payload parsed; fail open.");
  }

  const cwd = process.cwd();
  const spec = findSpec(cwd);
  if (spec === null) {
    allow("No .specs/next.md found in this project; spec loop not active.");
  }

  const root = projectRootFor(spec);
  const paths = extractPaths(payload, root);
  if (paths.length === 0) {
    allow("No file path detected.");
  }

  if (!paths.some((path) => isSource(path))) {
    allow(
      "Specs, tests, docs, config, and workflow files are allowed before approval."
    );
  }

  let text: string;
  try {
    text = readFileSync(spec, "utf8");
  } catch (error: unknown) {
    const name = error instanceof Error ? error.constructor.name : "Error";
    allow(`Spec found but unreadable (${name}); failing open.`);
  }

  const relSpec = relative(root, spec).split(sep).join(posix.sep);

  if (text.split("\n").length > MAX_SPEC_LINES) {
    block(
      `Source write blocked: ${relSpec} is over ${String(MAX_SPEC_LINES)} lines. Shrink the slice; don't add ceremony.`
    );
  }

  if (!isApproved(text)) {
    block(
      `Source write blocked. Review ${relSpec}, then run your spec slash command with \`approve\` (Claude Code plugin: \`/solo-spec-loop:spec approve\`) once you have explicitly approved the slice.`
    );
  }

  allow("Approved micro-spec found; source writes allowed for this slice.");
}

void main();
