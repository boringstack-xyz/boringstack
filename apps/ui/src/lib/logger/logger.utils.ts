import * as Sentry from "@sentry/react";

import { env } from "@/lib/env";
import { now } from "@/lib/time/now";

import { PII_KEYS } from "./logger.constants";
import type { ILogEvent, ILogLevel } from "./logger.types";

function mask(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(mask);
  }

  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.includes(key)) {
      out[key] = "[redacted]";
    } else if (typeof raw === "object" && raw !== null) {
      out[key] = mask(raw);
    } else {
      out[key] = raw;
    }
  }

  return out;
}

export function emit(level: ILogLevel, payload: ILogEvent): void {
  const masked = mask(payload) as Record<string, unknown>;
  const entry = {
    level,
    timestamp: now(),
    app: env.VITE_APP_NAME,
    ...masked
  };

  if (env.DEV) {
    const fn = level === "error" ? console.error : console.log;

    fn(entry);

    return;
  }

  Sentry.addBreadcrumb({
    level: level === "warn" ? "warning" : level,
    category: typeof masked.event === "string" ? masked.event : "log",
    data: masked
  });

  console.log(JSON.stringify(entry));
}
