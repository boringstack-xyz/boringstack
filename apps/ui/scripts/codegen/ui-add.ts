#!/usr/bin/env tsx
/**
 * `bun run ui:add <component>`: runs `shadcn add`, then rewrites what it
 * wrote to this template's rules (see ui-add.utils.ts) and formats it.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

import { adaptShadcnSource, addedCnPackage } from "./ui-add.utils";

const ROOT = process.cwd();
const COMPONENTS = resolve(ROOT, "src", "components");
const MANIFEST = resolve(ROOT, "package.json");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function snapshot(): Map<string, number> {
  return new Map(
    sourceFiles(COMPONENTS).map((file) => [file, statSync(file).mtimeMs])
  );
}

function readManifest(): Record<string, unknown> {
  return z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(MANIFEST, "utf8")));
}

function run(command: string, args: string[]): number {
  return spawnSync(command, args, { stdio: "inherit", cwd: ROOT }).status ?? 1;
}

const before = snapshot();
const manifestBefore = readManifest();
const status = run(resolve(ROOT, "node_modules", ".bin", "shadcn"), [
  "add",
  ...process.argv.slice(2)
]);

const written = sourceFiles(COMPONENTS).filter(
  (file) => before.get(file) !== statSync(file).mtimeMs
);

for (const file of written) {
  const source = readFileSync(file, "utf8");
  const adapted = adaptShadcnSource(source);

  if (adapted !== source) {
    writeFileSync(file, adapted);
  }
}

if (addedCnPackage(manifestBefore, readManifest())) {
  run("bun", ["remove", "cn"]);
}

if (written.length > 0) {
  run("bunx", ["prettier", "--write", ...written]);
  console.log(`[ui:add] adapted ${String(written.length)} file(s)`);
}

process.exit(status);
