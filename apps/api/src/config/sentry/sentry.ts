import * as Sentry from "@sentry/bun";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Initialize Sentry-compatible error tracking. Points at GlitchTip in the
 * default infra (see infra/compose/docs/glitchtip.md) or at
 * sentry.io for hosted — same wire protocol, same DSN format. No-op when
 * `SENTRY_DSN` is empty, so dev/test stays clean.
 *
 * Called once, early in `src/index.ts` — before the Elysia app is built so
 * any error during bootstrap is captured.
 */
export const initializeSentry = (): void => {
  if (env.SENTRY_DSN === "") {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Bun-side defaults; tune per workload.
    sampleRate: 1.0,
    release: env.APP_NAME,
  });

  logger.info("Sentry initialized", {
    event: "sentry.initialized",
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
};

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

/**
 * Capture an unhandled error and flush the transport before resolving. Use
 * from custom error handlers when the default Sentry instrumentation can't
 * see the failure (background workers, queue jobs, fatal handlers about to
 * `process.exit`). Awaiting the returned promise is what guarantees the
 * event actually leaves the process — `captureException` alone only
 * enqueues to the in-memory transport.
 */
export const captureError = async (
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> => {
  if (env.SENTRY_DSN === "") {
    return;
  }

  Sentry.captureException(
    error,
    context !== undefined ? { extra: context } : undefined
  );

  try {
    await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch {
    /* swallowed: flush failure shouldn't take down a fatal-handler path. */
  }
};
