import type { LOG_EVENTS } from "./logger.events";

export type ILogEventName = (typeof LOG_EVENTS)[number];

export type ILogLevel = "debug" | "info" | "warn" | "error";

export interface ILogEvent {
  readonly event: ILogEventName;
  readonly [key: string]: unknown;
}

export interface ILogger {
  debug(payload: ILogEvent): void;
  info(payload: ILogEvent): void;
  warn(payload: ILogEvent): void;
  error(payload: ILogEvent & { error?: unknown }): void;
}
