import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Reads a JSON file; undefined when missing or unreadable. */
export const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
};

export const readText = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

/** Writes atomically (temp file, then rename), creating the folder. */
export const writeText = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });

  const temporary = `${path}.${String(process.pid)}.tmp`;

  writeFileSync(temporary, text, { mode: 0o600 });
  renameSync(temporary, path);
};

export const writeJson = (path: string, value: unknown): void => {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A string → string record, or undefined. */
export const parseStringRecord = (
  value: unknown
): Record<string, string> | undefined =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : undefined;

/** Branch names as file names: `factory/issue-1` → `factory%2Fissue-1`. */
export const slug = (branch: string): string =>
  branch.replaceAll("%", "%25").replaceAll("/", "%2F");
