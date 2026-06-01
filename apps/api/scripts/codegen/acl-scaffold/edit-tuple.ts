import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONSTANTS_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "..",
  "src",
  "lib",
  "acl",
  "acl.constants.ts"
);

function escapeForRegex(value: string): string {
  return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

function parseTupleItems(body: string): string[] {
  const items: string[] = [];
  const pattern = /"([^"]+)"|ROLE\.(\w+)/g;

  for (const member of body.matchAll(pattern)) {
    const value = member[1] ?? member[2];

    if (value !== undefined) {
      items.push(value);
    }
  }

  return items;
}

function usesRoleReferences(body: string): boolean {
  return /ROLE\.\w+/.test(body);
}

function formatTupleItem(body: string, item: string): string {
  if (usesRoleReferences(body)) {
    return `ROLE.${item}`;
  }

  return `"${item}"`;
}

/**
 * Inserts `name` into the named const-tuple in acl.constants.ts. Idempotent:
 * a no-op when `name` is already present. Returns true when the file was
 * modified, false when no change was needed. Throws when the file or the
 * tuple cannot be located so the caller surfaces a clean error.
 */
export function appendToTuple(tupleName: string, name: string): boolean {
  const source = readFileSync(CONSTANTS_PATH, "utf8");
  const pattern = new RegExp(
    `(export const ${tupleName} = \\[)([\\s\\S]*?)(\\] as const;)`
  );
  const match = pattern.exec(source);

  if (!match) {
    throw new Error(
      `Could not locate const tuple '${tupleName}' in ${CONSTANTS_PATH}`
    );
  }

  const opener = match[1] ?? "";
  const body = match[2] ?? "";
  const closer = match[3] ?? "";
  const items = parseTupleItems(body);

  if (items.includes(name)) {
    return false;
  }

  const hasAllSentinel = items[items.length - 1] === "all";
  const target = hasAllSentinel ? items.length - 1 : items.length;

  items.splice(target, 0, name);

  const formattedBody = `\n  ${items.map((item) => formatTupleItem(body, item)).join(",\n  ")},\n`;

  const next =
    source.slice(0, match.index) +
    opener +
    formattedBody +
    closer +
    source.slice(match.index + match[0].length);

  writeFileSync(CONSTANTS_PATH, next, "utf8");

  return true;
}

/**
 * Inserts a new feature-catalog entry into the FEATURES object. Idempotent
 * by key. Returns true when the file was modified.
 */
export function appendFeature(
  name: string,
  kind: "boolean" | "limit",
  defaultValue: boolean | number
): boolean {
  const source = readFileSync(CONSTANTS_PATH, "utf8");
  const pattern = /(export const FEATURES = {)([\S\s]*?)(} as const;)/;
  const match = pattern.exec(source);

  if (!match) {
    throw new Error(`Could not locate FEATURES object in ${CONSTANTS_PATH}`);
  }

  const opener = match[1] ?? "";
  const body = match[2] ?? "";
  const closer = match[3] ?? "";

  if (new RegExp(`^\\s*${escapeForRegex(name)}:`, "m").test(body)) {
    return false;
  }

  const literal =
    typeof defaultValue === "boolean"
      ? String(defaultValue)
      : String(defaultValue);
  const newEntry = `  ${name}: { kind: "${kind}", default: ${literal} },\n`;

  /*
   * Preserve the existing body's leading newline + indent, then append the
   * new entry right before the closing brace. The body always ends in
   * "\n", so we just concatenate.
   */
  const next =
    source.slice(0, match.index) +
    opener +
    body +
    newEntry +
    closer +
    source.slice(match.index + match[0].length);

  writeFileSync(CONSTANTS_PATH, next, "utf8");

  return true;
}
