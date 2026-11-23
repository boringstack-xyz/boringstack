/*
 * LAN-only operator admin API entrypoint. Same boot order as src/index.ts up
 * to the invariants, then resolves the operator. It starts no notification
 * scheduling and no queue workers: those belong to the public API process.
 */
import "./instrument";

import { assertBootInvariants, BootInvariantError } from "./boot/invariants";
import { resolveOperator, setResolvedOperator } from "./boot/operator";
import { createAdminApp } from "./config/app/admin-app";
import { env } from "./config/env";
import {
  abortBootstrap,
  initializeErrorHandlers,
} from "./config/error-handlers";
import { logStartup } from "./config/logger";
import { initializeSentry } from "./config/sentry";
import { MAX_BODY_SIZE_BYTES } from "./middleware/body-limit";

initializeSentry();

try {
  assertBootInvariants(env);
  setResolvedOperator(await resolveOperator());
} catch (error) {
  if (error instanceof BootInvariantError) {
    abortBootstrap(error.message, "boot.invariants_failed", error);
  }

  throw error;
}

const app = createAdminApp().listen({
  port: env.ADMIN_PORT,
  maxRequestBodySize: MAX_BODY_SIZE_BYTES,
});

initializeErrorHandlers(app);

logStartup(
  app.server?.hostname ?? "localhost",
  app.server?.port ?? env.ADMIN_PORT
);
