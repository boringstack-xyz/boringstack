/*
 * OpenTelemetry init must run before anything that touches HTTP / ioredis /
 * undici, so the auto-instrumentations can patch them at import time. See
 * src/instrument.ts.
 */
import "./instrument";

import { assertBootInvariants, BootInvariantError } from "./boot/invariants";
import { createApp } from "./config/app";
import { env } from "./config/env";
import {
  abortBootstrap,
  initializeErrorHandlers,
} from "./config/error-handlers";
import { logStartup } from "./config/logger";
import { initializeSentry } from "./config/sentry";
import { setupNotifications, setupQueues } from "./config/setup";

// Initialize Sentry after OTel so error events pick up the OTel trace context.
initializeSentry();

/*
 * Boot invariants gate everything else. A misconfigured deploy aborts
 * here with a structured error instead of surfacing as a 500 to the
 * first user who hits the affected code path.
 */
try {
  assertBootInvariants(env);
} catch (error) {
  if (error instanceof BootInvariantError) {
    abortBootstrap(error.message, "boot.invariants_failed", error);
  }

  throw error;
}

/*
 * Notifications boot is unconditional — channels + events power the inline
 * dispatch path even when QUEUES_ENABLED is false.
 */
setupNotifications();

/*
 * Queues MUST finish initializing before the HTTP listener accepts
 * connections. Otherwise a request landing during the gap sees
 * QUEUES_ENABLED=true but a null QueueManager, falls through to inline
 * email send, and the operator gets unexplained latency spikes during
 * deploys. Boot order: env invariants → notifications + queues →
 * listen. setupQueues is allowed to throw — failure aborts the boot
 * via `abortBootstrap`, the listener never opens.
 */
if (env.QUEUES_ENABLED) {
  try {
    await setupQueues();
  } catch (error: unknown) {
    abortBootstrap(
      "Failed to initialize queues at boot",
      "queues.init_failed",
      error
    );
  }
}

const app = createApp().listen(env.PORT);

initializeErrorHandlers(app);

logStartup(app.server?.hostname ?? "localhost", app.server?.port ?? env.PORT);
