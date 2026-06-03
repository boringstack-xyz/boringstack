import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Every external client gets an explicit time budget — implicit SDK
 * defaults range from 80s (Stripe) to 10min (Anthropic), and a raw
 * fetch without a signal waits for the socket. A hung upstream must
 * never pin a request worker. Two checks:
 *  - known SDK constructors must pass a `timeout` option within the
 *    construction expression;
 *  - `fetch(` calls in src must carry `signal` in the same statement
 *    (window: the constructor/call plus the following ~15 lines).
 */
const SDK_CONSTRUCTORS = ["new Stripe(", "new OpenAI(", "new Anthropic("];
const WINDOW_LINES = 15;

function windowAfter(lines: string[], index: number): string {
  return lines.slice(index, index + WINDOW_LINES).join("\n");
}

export function checkExternalClientTimeouts(
  sourceFiles: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of sourceFiles) {
    if (!file.includes("/src/") || file.endsWith(".test.ts")) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split("\n");

    for (const [index, line] of lines.entries()) {
      for (const constructor of SDK_CONSTRUCTORS) {
        if (
          line.includes(constructor) &&
          !windowAfter(lines, index).includes("timeout")
        ) {
          violations.push({
            file,
            rule: "external-client-timeout",
            message: `Line ${String(index + 1)}: ${constructor.slice(4, -1)} constructed without a timeout option — implicit SDK defaults (80s–10min) can pin request workers on a slow upstream.`,
          });
        }
      }

      if (
        /(?:await|return)\s+fetch\(/u.test(line) &&
        !windowAfter(lines, index).includes("signal")
      ) {
        violations.push({
          file,
          rule: "external-client-timeout",
          message: `Line ${String(index + 1)}: fetch() without an AbortSignal — a hung upstream waits for the socket lifetime. Pass signal: AbortSignal.timeout(...).`,
        });
      }
    }
  }

  return violations;
}

/** External SDK clients and raw fetch calls must carry explicit timeouts. */
export const externalClientTimeoutRule: IMetaRule = {
  id: "external-client-timeout",
  category: "source-text",
  description:
    "SDK clients (Stripe/OpenAI/Anthropic) need a timeout option; fetch() in src needs an AbortSignal.",
  run({ sourceFiles }) {
    return checkExternalClientTimeouts(sourceFiles);
  },
};
