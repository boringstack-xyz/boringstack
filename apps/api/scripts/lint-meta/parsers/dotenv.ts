import { readFileSync } from "node:fs";

export function parseDotenvKeys(file: string): ReadonlySet<string> {
  const text = readFileSync(file, "utf8");
  const out = new Set<string>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");

    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();

    if (/^[A-Z][A-Z0-9_]*$/u.test(key)) {
      out.add(key);
    }
  }

  return out;
}
