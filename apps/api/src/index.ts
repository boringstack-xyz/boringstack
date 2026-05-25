import { createApp } from "./config/app";
import { env } from "./config/env";
import {
  abortBootstrap,
  initializeErrorHandlers,
} from "./config/error-handlers";
import { logStartup } from "./config/logger";
import { initializeSentry } from "./config/sentry";
import { setupNotifications, setupQueues } from "./config/setup";

// Initialize Sentry FIRST so any bootstrap error is captured.
initializeSentry();

const app = createApp().listen(env.PORT);

initializeErrorHandlers(app);

/*
 * Notifications boot is unconditional — channels + events power the inline
 * dispatch path even when QUEUES_ENABLED is false.
 */
setupNotifications();

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

logStartup(app.server?.hostname ?? "localhost", app.server?.port ?? env.PORT);
