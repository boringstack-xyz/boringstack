import { env } from "../../config/env";
import { aiCheck } from "./checks/ai.check";
import { databaseCheck } from "./checks/database.check";
import { emailCheck } from "./checks/email.check";
import { valkeyCheck } from "./checks/valkey.check";
import { runChecks } from "./health.runner";
import type { IReadinessCheck, IReadinessReport } from "./health.types";

const hasOAuthProvider = (): boolean =>
  (env.GOOGLE_OAUTH_CLIENT_ID !== "" &&
    env.GOOGLE_OAUTH_CLIENT_SECRET !== "") ||
  (env.GITHUB_OAUTH_CLIENT_ID !== "" &&
    env.GITHUB_OAUTH_CLIENT_SECRET !== "") ||
  (env.LINKEDIN_OAUTH_CLIENT_ID !== "" &&
    env.LINKEDIN_OAUTH_CLIENT_SECRET !== "");

/**
 * Returns the readiness checks enabled for the current configuration.
 * Valkey is only included when at least one Valkey-backed feature is on
 * (queues, valkey cache, SSE, or OAuth state). AI is always included: when
 * `AI_ENABLED=false` it reports "ok" rather than being skipped, so the
 * readiness JSON shape stays stable.
 */
export const enabledChecks = (): IReadinessCheck[] => {
  const checks: IReadinessCheck[] = [databaseCheck, emailCheck, aiCheck];
  const valkeyInUse =
    env.QUEUES_ENABLED ||
    (env.CACHE_ENABLED && env.CACHE_PROVIDER === "valkey") ||
    env.NOTIFICATIONS_SSE_ENABLED ||
    hasOAuthProvider();

  if (valkeyInUse) {
    checks.push(valkeyCheck);
  }

  return checks;
};

/** App-wide readiness aggregator. Routes /ready through this. */
export const runReadinessChecks = async (): Promise<IReadinessReport> =>
  runChecks(enabledChecks());
