import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface IPackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const out: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }

  return out;
}

export function parsePackageJson(text: string): IPackageJson | null {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  let dependencies: Record<string, string> | undefined;
  let devDependencies: Record<string, string> | undefined;

  for (const [key, value] of Object.entries(raw)) {
    if (key === "dependencies") {
      dependencies = toStringRecord(value);
    } else if (key === "devDependencies") {
      devDependencies = toStringRecord(value);
    }
  }

  return { dependencies, devDependencies };
}

export function readApiPackageJson(
  root: string
): { engines?: { bun?: string } } | null {
  const packageJsonPath = join(root, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  if (!("engines" in parsed)) {
    return {};
  }

  const engines = parsed.engines;

  if (engines === undefined) {
    return {};
  }

  if (typeof engines !== "object" || engines === null) {
    return {};
  }

  if (!("bun" in engines)) {
    return { engines: {} };
  }

  const bun = engines.bun;

  if (typeof bun !== "string") {
    return { engines: {} };
  }

  return { engines: { bun } };
}
