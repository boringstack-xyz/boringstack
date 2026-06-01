import { logger } from "../../config/logger";

const isStringRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const collectStringEntries = (
  obj: Record<string, unknown>
): Record<string, string> => {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }

  return out;
};

const warnInvalid = (reason: string): void => {
  logger.warn(`OPENAI_DEFAULT_HEADERS ${reason} — ignoring`, {
    event: "ai_default_headers_invalid",
  });
};

/**
 * Parses `OPENAI_DEFAULT_HEADERS` (a JSON object) into a flat
 * `Record<string, string>`. Returns `undefined` when unset, malformed, or
 * empty after filtering — the factory then omits the option entirely so
 * the SDK falls back to its own defaults.
 *
 * Example:
 *   OPENAI_DEFAULT_HEADERS='{"HTTP-Referer":"https://example.com","X-Title":"My App"}'
 */
export const parseDefaultHeaders = (
  raw: string
): Record<string, string> | undefined => {
  if (raw === "") {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    warnInvalid("is not valid JSON");

    return undefined;
  }

  if (!isStringRecord(parsed)) {
    warnInvalid("is not a JSON object");

    return undefined;
  }

  const entries = collectStringEntries(parsed);

  return Object.keys(entries).length > 0 ? entries : undefined;
};
