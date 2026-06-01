import { env } from "../../../config/env";
import { getErrorMessage } from "../../../lib/errors";
import type { IReadinessCheck, IReadinessResult } from "../health.types";
import { getHealthClient } from "./valkey.check.client";
import { nowMs } from "../../../lib/time/now";

export { closeValkeyHealthClient } from "./valkey.check.client";

export const valkeyCheck: IReadinessCheck = {
  name: "valkey",
  run: async (): Promise<IReadinessResult> => {
    const start = nowMs();

    if (env.isTest) {
      return {
        name: "valkey",
        status: "down",
        latencyMs: nowMs() - start,
        message: "Valkey readiness probe is disabled in test mode",
      };
    }

    try {
      const client = getHealthClient();

      await client.ping();

      return { name: "valkey", status: "ok", latencyMs: nowMs() - start };
    } catch (error: unknown) {
      return {
        name: "valkey",
        status: "down",
        latencyMs: nowMs() - start,
        message: getErrorMessage(error),
      };
    }
  },
};
