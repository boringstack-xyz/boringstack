import * as Sentry from "@sentry/bun";
import pino from "pino";
import { env } from "../env";
import type { LOG_EVENTS } from "./logger.events";

type ILogEventName = (typeof LOG_EVENTS)[number];

/*
 * Inject Sentry-scoped correlation fields on every log record:
 *   - trace_id + span_id from the active Sentry/OTel span
 *   - userId from the current scope (set by auth.plugin.ts after the
 *     user is resolved on an authenticated request)
 *
 * Promtail extracts these as Loki structured metadata so a log line
 * surfaced in Grafana can be pivoted to its trace or its user in
 * Sentry/GlitchTip by the same id. Each field is a no-op when its
 * source isn't set — unauthenticated requests get trace ids but no
 * userId; everything is `{}` before Sentry.init when no DSN is
 * configured.
 */
const traceMixin = (): Record<string, string> => {
  const fields: Record<string, string> = {};

  const span = Sentry.getActiveSpan();

  if (span !== undefined) {
    const ctx = span.spanContext();

    fields.trace_id = ctx.traceId;
    fields.span_id = ctx.spanId;
  }

  const userId = Sentry.getCurrentScope().getUser()?.id;

  if (userId !== undefined) {
    fields.userId = String(userId);
  }

  return fields;
};

/*
 * JSON in every environment — Loki is the canonical log viewer and
 * Promtail's Pino pipeline depends on structured output. For ad-hoc
 * tailing pipe through `bunx pino-pretty`.
 */
const baseLogger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  mixin: traceMixin,
});

type ChildBindings = Record<string, unknown>;
type EventCtx = { event: ILogEventName } & Record<string, unknown>;

/*
 * Pino 10 strictly requires (obj, msg) when passing context. We expose a
 * (msg, ctx?) shim to keep call sites readable. `child()` is preserved so
 * per-request loggers still work; its bindings are unconstrained because
 * they're request-scoped metadata, not an event.
 */
interface IAppLogger {
  fatal: (msg: string, ctx?: EventCtx) => void;
  error: (msg: string, ctx?: EventCtx) => void;
  warn: (msg: string, ctx?: EventCtx) => void;
  info: (msg: string, ctx?: EventCtx) => void;
  debug: (msg: string, ctx?: EventCtx) => void;
  trace: (msg: string, ctx?: EventCtx) => void;
  child: (bindings: ChildBindings) => IAppLogger;
}

const wrap = (instance: pino.Logger): IAppLogger => {
  const call = (
    method: "fatal" | "error" | "warn" | "info" | "debug" | "trace",
    msg: string,
    ctx: EventCtx | undefined
  ): void => {
    if (ctx === undefined) {
      instance[method](msg);
    } else {
      instance[method](ctx, msg);
    }
  };

  return {
    fatal: (msg, ctx) => {
      call("fatal", msg, ctx);
    },
    error: (msg, ctx) => {
      call("error", msg, ctx);
    },
    warn: (msg, ctx) => {
      call("warn", msg, ctx);
    },
    info: (msg, ctx) => {
      call("info", msg, ctx);
    },
    debug: (msg, ctx) => {
      call("debug", msg, ctx);
    },
    trace: (msg, ctx) => {
      call("trace", msg, ctx);
    },
    child: (bindings) => wrap(instance.child(bindings)),
  };
};

export const logger: IAppLogger = wrap(baseLogger);
