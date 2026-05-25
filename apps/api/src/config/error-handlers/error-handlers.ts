import { closeValkeyHealthClient } from "../../api/health";
import { postgresClient } from "../../clients/postgres";
import { cacheService } from "../../lib/cache";
import { getErrorMessage } from "../../lib/errors";
import { oauthStateStore } from "../../lib/oauth";
import { env } from "../env";
import { logger } from "../logger";
import type { LOG_EVENTS } from "../logger/logger.events";
import { captureError } from "../sentry";
import { getQueueManager } from "../setup";

/*
 * The live Elysia app is set by `initializeErrorHandlers(app)` at boot.
 * Shutdown stops the HTTP listener BEFORE tearing down the data layer so
 * we don't drain Postgres / Valkey out from under in-flight requests.
 *
 * `IRunningApp` is structurally typed — Elysia's `stop()` carries a deep
 * generic surface we don't need here, so we narrow to the only method
 * shutdown actually calls.
 */
interface IRunningApp {
  stop: () => unknown;
}
let runningApp: IRunningApp | null = null;

const stopHttpListener = async (): Promise<void> => {
  if (runningApp === null) {
    return;
  }

  try {
    await Promise.resolve(runningApp.stop());
    logger.info("HTTP listener stopped", {
      event: "graceful_shutdown.listener_stopped",
    });
  } catch (error: unknown) {
    logger.error("Failed to stop HTTP listener", {
      event: "graceful_shutdown.listener_stop_failed",
      error: getErrorMessage(error),
    });
  }
};

const gracefulShutdown = async (): Promise<void> => {
  try {
    logger.info("Starting graceful shutdown process", {
      event: "graceful_shutdown_process",
    });

    /*
     * Order matters: stop accepting new requests first, then drain
     * dependencies. The reverse order can return 5xx to a request that
     * already arrived because the DB pool ended mid-query.
     */
    await stopHttpListener();

    const manager = getQueueManager();

    if (manager !== null) {
      await manager.close();
    }

    logger.info("Closing cache connection", {
      event: "cache_close",
      provider: cacheService.providerName,
    });

    await cacheService.close();
    await closeValkeyHealthClient();
    await oauthStateStore.close();

    logger.info("Closing database connections", {
      event: "db_connection_close",
    });

    await postgresClient.end();
    logger.info("Database connections closed", {
      event: "db_connection_closed",
    });

    logger.info("Graceful shutdown completed", {
      event: "graceful_shutdown_complete",
    });

    process.exit(0);
  } catch (error: unknown) {
    logger.error("Error during graceful shutdown", {
      event: "graceful_shutdown_error",
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
};

const setupGlobalErrorHandlers = (): void => {
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection", {
      event: "unhandled_rejection",
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    /*
     * `void` discards the promise but the IIFE awaits the flush before
     * calling `process.exit`. Without the await, Node tears the process
     * down before Sentry's transport finishes its HTTP round-trip and
     * the event is lost.
     */
    void (async () => {
      await captureError(reason, { kind: "unhandledRejection" });

      if (env.NODE_ENV === "production") {
        process.exit(1);
      }
    })();
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", {
      event: "uncaught_exception",
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    void (async () => {
      await captureError(error, { kind: "uncaughtException" });
      process.exit(1);
    })();
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, starting graceful shutdown", {
      event: "graceful_shutdown_start",
    });

    void gracefulShutdown();
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, starting graceful shutdown", {
      event: "graceful_shutdown_start",
    });

    void gracefulShutdown();
  });

  process.on("warning", (warning) => {
    logger.warn("Process Warning", {
      event: "process_warning",
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
};

export const initializeErrorHandlers = (app: IRunningApp): void => {
  runningApp = app;
  setupGlobalErrorHandlers();
  logger.info("Global error handlers initialized", {
    event: "error_handlers_initialized",
  });
};

export const abortBootstrap = (
  message: string,
  event: (typeof LOG_EVENTS)[number],
  error?: unknown
): never => {
  logger.error(message, {
    event,
    error: error === undefined ? undefined : getErrorMessage(error),
  });

  process.exit(1);
};
