import type { EventEmitter } from "node:events";

import type { Queue } from "bullmq";

import { logger } from "../../config/logger";
import { nowMs } from "../../lib/time/now";

/*
 * One process-wide view of "is Valkey reachable", shared by every client
 * (cache, rate limit, OAuth state, pub/sub, health, BullMQ workers).
 *
 * Each ioredis client retries on its own and emits `error` on every failed
 * attempt, so a 40-second Valkey restart used to print ~90 lines across
 * nine clients. Instead:
 *
 *   - first connection error from any client → one WARN (lost)
 *   - still unreachable after two minutes       → one ERROR (real outage)
 *   - every client that failed is ready again   → one INFO (restored)
 *
 * Errors that are not connection failures (a bad command, a BullMQ lock
 * problem) go to the caller's own handler unchanged.
 */

const DOWN_ESCALATE_MS = 2 * 60_000;

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

const CONNECTION_ERROR_MESSAGES = [
  /^connect /,
  /^getaddrinfo /,
  /^Connection is closed/,
  /^Stream isn't writeable/,
];

export const isValkeyConnectionError = (err: Error): boolean => {
  const hasConnectionCode =
    "code" in err &&
    typeof err.code === "string" &&
    CONNECTION_ERROR_CODES.has(err.code);

  return (
    hasConnectionCode ||
    CONNECTION_ERROR_MESSAGES.some((pattern) => pattern.test(err.message))
  );
};

interface IOutage {
  startedMs: number;
  firstSource: string;
  firstError: string;
  escalated: boolean;
  timer: ReturnType<typeof setTimeout>;
}

const downClients = new Map<object, string>();
let outage: IOutage | null = null;
let escalateAfterMs = DOWN_ESCALATE_MS;

const escalate = (): void => {
  if (outage === null) {
    return;
  }

  outage.escalated = true;
  logger.error("Valkey still unreachable", {
    event: "valkey.connection.down",
    downForMs: nowMs() - outage.startedMs,
    sources: [...new Set(downClients.values())],
    error: outage.firstError,
  });
};

const markDown = (client: object, source: string, err: Error): void => {
  downClients.set(client, source);

  if (outage !== null) {
    logger.debug("Valkey connection error during outage", {
      event: "valkey.connection.retry",
      source,
      error: err.message,
    });

    return;
  }

  outage = {
    startedMs: nowMs(),
    firstSource: source,
    firstError: err.message,
    escalated: false,
    timer: setTimeout(escalate, escalateAfterMs),
  };
  outage.timer.unref();
  logger.warn("Valkey connection lost; retrying", {
    event: "valkey.connection.lost",
    source,
    error: err.message,
  });
};

const markUp = (client: object): void => {
  if (!downClients.delete(client) || downClients.size > 0 || outage === null) {
    return;
  }

  clearTimeout(outage.timer);
  logger.info("Valkey connection restored", {
    event: "valkey.connection.restored",
    downForMs: nowMs() - outage.startedMs,
    firstSource: outage.firstSource,
    escalated: outage.escalated,
  });
  outage = null;
};

/**
 * Route a client's connection errors through the shared outage log.
 * `onOtherError` receives every error that is not a connection failure.
 * Works for ioredis clients (`ready`/`end`) and BullMQ workers
 * (`ready`/`closed`).
 */
export const watchValkeyConnection = (
  client: EventEmitter,
  source: string,
  onOtherError: (err: Error) => void
): void => {
  client.on("error", (err: Error) => {
    if (isValkeyConnectionError(err)) {
      markDown(client, source, err);

      return;
    }

    onOtherError(err);
  });
  client.on("ready", () => {
    markUp(client);
  });
  // A closed client never comes back, so it must not hold the outage open.
  client.on("end", () => {
    markUp(client);
  });
  client.on("closed", () => {
    markUp(client);
  });
};

/*
 * A BullMQ Queue forwards its connection's errors but never emits `ready`,
 * so its recovery signal comes from the raw client it runs on. The client
 * promise resolves only once that client has connected, which also covers
 * a Queue that first failed before Valkey came up.
 */
export const watchValkeyQueue = (
  queue: Queue,
  source: string,
  onOtherError: (err: Error) => void
): void => {
  queue.on("error", (err: Error) => {
    if (isValkeyConnectionError(err)) {
      markDown(queue, source, err);

      return;
    }

    onOtherError(err);
  });
  queue.client.then(
    (client) => {
      client.on("ready", () => {
        markUp(queue);
      });
      markUp(queue);
    },
    () => undefined
  );
};

/** True while any watched client is failing to reach Valkey. */
export const isValkeyDown = (): boolean => outage !== null;

/** Test-only: drop all state between cases. */
export const resetValkeyConnectionWatch = (
  options: { escalateAfterMs?: number } = {}
): void => {
  escalateAfterMs = options.escalateAfterMs ?? DOWN_ESCALATE_MS;

  if (outage !== null) {
    clearTimeout(outage.timer);
  }

  outage = null;
  downClients.clear();
};
