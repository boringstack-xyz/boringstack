#!/usr/bin/env bun
/**
 * Child process for F13.
 *
 * The finding is that a rejected, `void`-discarded notification escapes as an
 * unhandled rejection, which `error-handlers.ts:113` turns into
 * `process.exit(1)` under NODE_ENV=production.
 *
 * This runs in the ordinary test environment and the parent asserts on the
 * log marker the real handler emits (`"event":"unhandled_rejection"`), not on
 * a production exit. Two reasons: the runner cannot observe an unhandled
 * rejection itself (Bun intercepts them and attributes them to whichever test
 * is in flight), and production mode forces TLS on the Postgres client
 * (`clients/postgres/index.ts:9`), which neither the local throwaway database
 * nor the CI service container provides.
 *
 * The marker is the defect. The `process.exit(1)` that follows it in
 * production is one branch away in the same handler.
 */
import { oauthAuthService } from "../../src/api/auth/services/oauth.service";
import { initializeErrorHandlers } from "../../src/config/error-handlers";
import { notifications } from "../../src/lib/notifications";
import { postgresClient } from "../../tests/helpers/db";
import type { IOAuthProfile } from "../../src/lib/oauth/oauth.types";

/* Only `stop` is used, and only during graceful shutdown. */
initializeErrorHandlers({ stop: () => undefined });

/*
 * Stand in for a queue or Valkey outage. `NotificationDispatcher.send`
 * genuinely rejects on both schema validation and inline dispatch failure, so
 * this is the shape production produces, not an invented one.
 */
if (process.env.NOTIFICATIONS_FAIL === "true") {
  notifications.send = (): Promise<void> =>
    Promise.reject(new Error("queue unavailable"));
}

const email = process.argv[2] ?? "f13-child@gmail.com";

const profile: IOAuthProfile = {
  providerUserId: `google-${email}`,
  email,
  emailVerified: true,
  firstName: "New",
  lastName: "User",
};

await oauthAuthService.loginOrRegisterFromProfile("google", profile);

/*
 * Give the discarded promise time to be classified as unhandled. If the
 * production handler fires it exits 1 from under us before this resolves.
 */
await Bun.sleep(750);

/*
 * Close the pool so the loop drains and the process ends on its own. An
 * explicit `process.exit` is reserved for the graceful-shutdown path.
 */
await postgresClient.end();
