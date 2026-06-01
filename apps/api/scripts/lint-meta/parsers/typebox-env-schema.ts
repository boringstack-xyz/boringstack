import { readFileSync } from "node:fs";

export interface IEnvSchemaKey {
  readonly name: string;
  readonly hasDefault: boolean;
}

/*
 * The env schema is hand-written TypeBox of the shape
 *   KEY: t.<kind>(... default: ...),
 * each on its own line (multi-line `t.Union([...], { default: X })` blocks
 * span several lines — we detect those by tracking the brace depth and
 * scanning until the closing `)`).
 */
export function parseTypeboxEnvSchemaKeys(
  file: string
): readonly IEnvSchemaKey[] {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const out: IEnvSchemaKey[] = [];

  let current: { name: string; buffer: string; depth: number } | null = null;

  for (const raw of lines) {
    if (current === null) {
      const headerMatch = /^\s*([A-Z][A-Z0-9_]*)\s*:\s*t\./u.exec(raw);

      if (headerMatch?.[1] === undefined) {
        continue;
      }

      current = { name: headerMatch[1], buffer: raw, depth: 0 };
    } else {
      current.buffer += `\n${raw}`;
    }

    for (const char of current.buffer.slice(-raw.length - 1)) {
      if (char === "(" || char === "[" || char === "{") {
        current.depth += 1;
      } else if (char === ")" || char === "]" || char === "}") {
        current.depth -= 1;
      }
    }

    if (current.depth <= 0) {
      out.push({
        name: current.name,
        hasDefault: /\bdefault\s*:/u.test(current.buffer),
      });
      current = null;
    }
  }

  return out;
}
