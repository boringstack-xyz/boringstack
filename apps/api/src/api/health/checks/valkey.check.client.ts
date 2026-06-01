import { Redis } from "ioredis";
import { getValkeyAppClientOptions } from "../../../clients/valkey";
import { logger } from "../../../config/logger";

/** Probes must fail fast; never hang a load balancer waiting on Valkey. */
const PING_TIMEOUT_MS = 1500;

let healthClient: Redis | null = null;

/**
 * Lazy long-lived ioredis client used only by readiness probes. Separate
 * from BullMQ and the cache so probe traffic doesn't contend with real
 * workload connections, and so a paused queue/cache client never makes
 * the readiness probe lie.
 */
export const getHealthClient = (): Redis => {
  if (healthClient !== null) {
    return healthClient;
  }

  healthClient = new Redis(
    getValkeyAppClientOptions({ connectTimeout: PING_TIMEOUT_MS })
  );

  healthClient.on("error", (err: Error) => {
    logger.debug("Valkey health client error", {
      event: "health_valkey_error",
      error: err.message,
    });
  });

  return healthClient;
};

export const closeValkeyHealthClient = async (): Promise<void> => {
  if (healthClient === null) {
    return;
  }

  try {
    if (healthClient.status === "ready") {
      await healthClient.quit();
    } else {
      healthClient.disconnect();
    }
  } catch {
    // ignore; connection may already be closing
  }

  healthClient = null;
};
