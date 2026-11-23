#!/usr/bin/env bun
/*
 * Mirrors every Claude Code skill into the Codex layout.
 *
 * Source of truth: `<app>/.claude/skills/<name>/SKILL.md` (repo root and each
 * app). Generated mirror: `<app>/.agents/skills/<name>/SKILL.md`, byte-for-byte
 * copies. Codex discovers skills from `.agents/skills`, so the two harnesses
 * read the same prompt and cannot drift apart by hand.
 *
 *   bun scripts/sync-agent-skills.ts          write the mirror
 *   bun scripts/sync-agent-skills.ts --check  exit 1 if the mirror is stale
 *
 * The mirror directory is owned by this script: anything in it that is not
 * generated from a source skill is removed on write and reported on check.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

interface ISkillSet {
  readonly source: string;
  readonly mirror: string;
}

const SKILL_SETS: readonly ISkillSet[] = [
  { source: ".claude/skills", mirror: ".agents/skills" },
  { source: "apps/api/.claude/skills", mirror: "apps/api/.agents/skills" },
  { source: "apps/ui/.claude/skills", mirror: "apps/ui/.agents/skills" },
];

const SKILL_FILE = "SKILL.md";

/** Relative path (under the mirror dir) -> exact file content. */
type Expected = Map<string, string>;

function fail(message: string): never {
  console.error(`[sync-agent-skills] ${message}`);
  process.exit(1);
}

function listSkillNames(sourceDir: string): string[] {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const stray = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md")
  );

  if (stray.length > 0) {
    fail(
      `flat skill files in ${relative(ROOT, sourceDir)} (move each to <name>/${SKILL_FILE}): ` +
        stray.map((entry) => entry.name).join(", ")
    );
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Checks the frontmatter Claude Code and Codex both parse. */
function validateSkill(name: string, content: string, path: string): void {
  const lines = content.split("\n");

  if (lines[0] !== "---") {
    fail(`${path}: missing opening frontmatter fence`);
  }

  const close = lines.indexOf("---", 1);

  if (close === -1) {
    fail(`${path}: missing closing frontmatter fence`);
  }

  const front = lines.slice(1, close);
  const nameLine = front.find((line) => line.startsWith("name:"));
  const descriptionLine = front.find((line) => line.startsWith("description:"));

  if (nameLine?.slice("name:".length).trim() !== name) {
    fail(`${path}: frontmatter name must equal the directory name "${name}"`);
  }

  if (descriptionLine === undefined) {
    fail(`${path}: frontmatter needs a description`);
  }

  const description = descriptionLine.slice("description:".length).trim();

  if (description.length === 0) {
    fail(`${path}: description is empty`);
  }

  // An unquoted scalar with ": " is a YAML mapping error; the skill then loads with no description.
  if (!/^["']/u.test(description) && description.includes(": ")) {
    fail(
      `${path}: unquoted description contains ": " (quote the value or reword it)`
    );
  }
}

function buildExpected(set: ISkillSet): Expected {
  const sourceDir = join(ROOT, set.source);
  const expected: Expected = new Map();

  if (!existsSync(sourceDir)) {
    fail(`source directory missing: ${set.source}`);
  }

  for (const name of listSkillNames(sourceDir)) {
    const sourcePath = join(sourceDir, name, SKILL_FILE);

    if (!existsSync(sourcePath)) {
      fail(`${relative(ROOT, join(sourceDir, name))} has no ${SKILL_FILE}`);
    }

    const content = readFileSync(sourcePath, "utf8");

    validateSkill(name, content, relative(ROOT, sourcePath));
    expected.set(join(name, SKILL_FILE), content);
  }

  return expected;
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full, base));
    } else {
      files.push(relative(base, full));
    }
  }

  return files.sort();
}

function driftFor(set: ISkillSet, expected: Expected): string[] {
  const mirrorDir = join(ROOT, set.mirror);
  const drift: string[] = [];
  const actual = listFiles(mirrorDir);

  for (const [path, content] of expected) {
    const full = join(mirrorDir, path);

    if (!existsSync(full)) {
      drift.push(`missing ${relative(ROOT, full)}`);
    } else if (readFileSync(full, "utf8") !== content) {
      drift.push(`stale ${relative(ROOT, full)}`);
    }
  }

  for (const path of actual) {
    if (!expected.has(path)) {
      drift.push(`unexpected ${relative(ROOT, join(mirrorDir, path))}`);
    }
  }

  return drift;
}

function writeMirror(set: ISkillSet, expected: Expected): void {
  const mirrorDir = join(ROOT, set.mirror);

  rmSync(mirrorDir, { recursive: true, force: true });

  for (const [path, content] of expected) {
    const full = join(mirrorDir, path);

    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

function main(): void {
  const check = process.argv.includes("--check");
  const plans = SKILL_SETS.map((set) => ({
    set,
    expected: buildExpected(set),
  }));

  if (check) {
    const drift = plans.flatMap(({ set, expected }) => driftFor(set, expected));

    if (drift.length > 0) {
      console.error("[sync-agent-skills] Codex mirror is stale:\n");

      for (const line of drift) {
        console.error(`  - ${line}`);
      }

      console.error("\nrun: bun run skills:sync");
      process.exit(1);
    }

    const total = plans.reduce((sum, plan) => sum + plan.expected.size, 0);

    console.log(`[sync-agent-skills] ${total} skill mirror(s) up to date.`);

    return;
  }

  for (const { set, expected } of plans) {
    writeMirror(set, expected);
    console.log(
      `[sync-agent-skills] ${set.source} -> ${set.mirror} (${expected.size} skills)`
    );
  }
}

main();
