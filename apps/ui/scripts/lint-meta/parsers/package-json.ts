import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getErrorMessage } from "../../../src/lib/errors/getErrorMessage";

export interface IPackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }

  return out;
}

export interface IParsedPackageJson {
  readonly pkg: IPackageJson | null;
  readonly parseError: string | null;
}

export function parsePackageJson(text: string): IParsedPackageJson {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { pkg: null, parseError: getErrorMessage(error) };
  }

  if (typeof raw !== "object" || raw === null) {
    return { pkg: null, parseError: "Top-level JSON value is not an object." };
  }

  let dependencies: Record<string, string> | undefined;
  let devDependencies: Record<string, string> | undefined;
  let peerDependencies: Record<string, string> | undefined;

  for (const [key, value] of Object.entries(raw)) {
    if (key === "dependencies") {
      dependencies = toStringRecord(value);
    } else if (key === "devDependencies") {
      devDependencies = toStringRecord(value);
    } else if (key === "peerDependencies") {
      peerDependencies = toStringRecord(value);
    }
  }

  return {
    pkg: { dependencies, devDependencies, peerDependencies },
    parseError: null
  };
}

export function readUiPackageJson(root: string): {
  engines?: { node?: string };
  packageManager?: string;
} | null {
  const packageJsonPath = join(root, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const result: {
    engines?: { node?: string };
    packageManager?: string;
  } = {};

  if ("engines" in parsed) {
    const engines = parsed.engines;

    if (typeof engines === "object" && engines !== null && "node" in engines) {
      const node = engines.node;

      if (typeof node === "string") {
        result.engines = { node };
      }
    }
  }

  if ("packageManager" in parsed && typeof parsed.packageManager === "string") {
    result.packageManager = parsed.packageManager;
  }

  return result;
}
