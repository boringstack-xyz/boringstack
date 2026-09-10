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
import { MAX_BODY_SIZE_BYTES } from "./middleware/body-limit";

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

/*
 * The real body cap. `middleware/body-limit.ts` rejects a request that
 * ADVERTISES an over-cap Content-Length, which is cheap and happens before
 * parsing — but a header is a claim, and a chunked request makes no claim at
 * all. `maxRequestBodySize` is enforced by the server as the body streams, so
 * it is what actually bounds memory. Both exist on purpose.
 */
const app = createApp().listen({
  port: env.PORT,
  maxRequestBodySize: MAX_BODY_SIZE_BYTES,
});

initializeErrorHandlers(app);

logStartup(app.server?.hostname ?? "localhost", app.server?.port ?? env.PORT);
