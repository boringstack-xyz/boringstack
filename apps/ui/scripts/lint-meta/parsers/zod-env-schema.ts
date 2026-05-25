import { readFileSync } from "node:fs";

function parseSchemaAliasDefaults(text: string): ReadonlyMap<string, boolean> {
  const out = new Map<string, boolean>();
  const aliasDefPattern = /const\s+([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*z\./gmu;

  for (const match of text.matchAll(aliasDefPattern)) {
    const alias = match[1];

    if (alias === undefined) {
      continue;
    }

    const start = match.index;
    const nextBoundary = text.indexOf("\nexport ", start + 1);
    const end = nextBoundary === -1 ? text.length : nextBoundary;

    out.set(alias, text.slice(start, end).includes(".default("));
  }

  return out;
}

export function parseZodEnvSchemaKeys(
  file: string
): readonly { name: string; hasDefault: boolean }[] {
  const text = readFileSync(file, "utf8");
  const out: { name: string; hasDefault: boolean }[] = [];
  const aliasDefaults = parseSchemaAliasDefaults(text);
  const directPattern = /^\s*([A-Z][A-Z0-9_]*):\s*z\./gmu;
  const aliasPattern = /^\s*([A-Z][A-Z0-9_]*):\s*([a-z][a-zA-Z0-9_]*),/gmu;

  for (const match of text.matchAll(directPattern)) {
    const name = match[1];

    if (name === undefined) {
      continue;
    }

    const sliceStart = match.index;
    const sliceEnd = text.indexOf("\n", sliceStart);
    const line = text.slice(sliceStart, sliceEnd === -1 ? undefined : sliceEnd);

    out.push({ name, hasDefault: line.includes(".default(") });
  }

  for (const match of text.matchAll(aliasPattern)) {
    const name = match[1];
    const alias = match[2];

    if (name === undefined || alias === undefined) {
      continue;
    }

    out.push({
      name,
      hasDefault: aliasDefaults.get(alias) ?? false
    });
  }

  return out;
}

export function parseImportMetaEnvKeys(file: string): ReadonlySet<string> {
  const text = readFileSync(file, "utf8");
  const out = new Set<string>();
  const pattern = /^\s*readonly\s+([A-Z][A-Z0-9_]*):/gmu;

  for (const match of text.matchAll(pattern)) {
    const name = match[1];

    if (name !== undefined) {
      out.add(name);
    }
  }

  return out;
}
