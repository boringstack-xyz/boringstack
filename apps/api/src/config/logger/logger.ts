import pino from "pino";
import pretty from "pino-pretty";
import { env } from "../env";
import type { LOG_EVENTS } from "./logger.events";

type ILogEventName = (typeof LOG_EVENTS)[number];

const prettyStream = pretty({
  colorize: true,
  ignore: "pid,hostname",
});

const baseLogger = pino(
  {
    level: env.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
  },
  env.isDevelopment ? prettyStream : undefined
);

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
