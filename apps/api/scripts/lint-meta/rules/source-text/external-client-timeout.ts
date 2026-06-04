import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

/*
 * Every external client gets an explicit time budget — implicit SDK
 * defaults range from 80s (Stripe) to 10min (Anthropic), and a raw
 * fetch without a signal waits for the socket. A hung upstream must
 * never pin a request worker. Three checks:
 *  - SDK constructors that accept a timeout option must pass one within
 *    the construction expression (window: the next ~15 lines);
 *  - `fetch(` calls in src must carry `signal` in the same statement;
 *  - email transports must be bounded somewhere in their module. Resend
 *    and SendGrid expose no constructor/request timeout (they wrap fetch),
 *    so the send is bounded with `withEmailTimeout`; nodemailer's
 *    createTransport takes native connectionTimeout/socketTimeout. Each
 *    provider file is single-purpose, so a file-level check is precise.
 */
const SDK_CONSTRUCTORS = ["new Stripe(", "new OpenAI(", "new Anthropic("];
const RULE = "external-client-timeout";
const WINDOW_LINES = 15;

interface IEmailTransport {
  readonly call: string;
  readonly evidence: readonly string[];
}

/*
 * A transport call implies its module must contain at least one evidence
 * token. Resend/SendGrid wrap fetch with no timeout option (bound via
 * withEmailTimeout); nodemailer takes native connect/socket timeouts.
 */
const EMAIL_TRANSPORTS: readonly IEmailTransport[] = [
  {
    call: "new Resend(",
    evidence: ["withEmailTimeout", "AbortSignal.timeout"],
  },
  {
    call: ".setApiKey(",
    evidence: ["withEmailTimeout", "AbortSignal.timeout"],
  },
  {
    call: "createTransport(",
    evidence: ["connectionTimeout", "socketTimeout", "withEmailTimeout"],
  },
];

function windowAfter(lines: string[], index: number): string {
  return lines.slice(index, index + WINDOW_LINES).join("\n");
}

function emailTransportViolations(file: string, content: string): IViolation[] {
  const out: IViolation[] = [];

  for (const transport of EMAIL_TRANSPORTS) {
    if (
      content.includes(transport.call) &&
      !transport.evidence.some((token) => content.includes(token))
    ) {
      out.push({
        file,
        rule: RULE,
        message: `${transport.call.replace(/[.(]/gu, "")} without a request timeout — a hung mail upstream waits for the socket lifetime and pins the request worker. Bound the send with withEmailTimeout (Resend/SendGrid) or pass connectionTimeout/socketTimeout (nodemailer).`,
      });
    }
  }

  return out;
}

function lineTimeoutViolations(file: string, lines: string[]): IViolation[] {
  const out: IViolation[] = [];

  for (const [index, line] of lines.entries()) {
    const constructor = SDK_CONSTRUCTORS.find((ctor) => line.includes(ctor));

    if (
      constructor !== undefined &&
      !windowAfter(lines, index).includes("timeout")
    ) {
      out.push({
        file,
        rule: RULE,
        message: `Line ${String(index + 1)}: ${constructor.slice(4, -1)} constructed without a timeout option — implicit SDK defaults (80s–10min) can pin request workers on a slow upstream.`,
      });
    }

    if (
      /(?:await|return)\s+fetch\(/u.test(line) &&
      !windowAfter(lines, index).includes("signal")
    ) {
      out.push({
        file,
        rule: RULE,
        message: `Line ${String(index + 1)}: fetch() without an AbortSignal — a hung upstream waits for the socket lifetime. Pass signal: AbortSignal.timeout(...).`,
      });
    }
  }

  return out;
}

export function checkExternalClientTimeouts(
  sourceFiles: readonly string[]
): IViolation[] {
  const violations: IViolation[] = [];

  for (const file of sourceFiles) {
    if (!file.includes("/src/") || file.endsWith(".test.ts")) {
      continue;
    }

    const content = readFileSync(file, "utf8");

    violations.push(
      ...emailTransportViolations(file, content),
      ...lineTimeoutViolations(file, content.split("\n"))
    );
  }

  return violations;
}

/** External SDK clients and raw fetch calls must carry explicit timeouts. */
export const externalClientTimeoutRule: IMetaRule = {
  id: "external-client-timeout",
  category: "source-text",
  description:
    "SDK clients (Stripe/OpenAI/Anthropic) need a timeout option; email transports (Resend/SendGrid/nodemailer) must be bounded; fetch() in src needs an AbortSignal.",
  run({ sourceFiles }) {
    return checkExternalClientTimeouts(sourceFiles);
  },
};
