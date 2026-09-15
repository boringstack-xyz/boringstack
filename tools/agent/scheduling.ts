import { availableParallelism, totalmem } from "node:os";
import { verificationEnvironment } from "./environment";

export interface IExecutionBudget {
  slots: number;
  /** Playwright workers; also the number of security-spec shards. */
  testWorkers: number;
  /** Vitest workers: the UI suite is the long pole once the spec is sharded. */
  uiTestWorkers: number;
  securityShards: number;
  apiShards: number;
}

const MAX_UI_WORKERS = 8;
const MAX_SHARDS = 4;

const GIB = 1024 ** 3;

/** Reserve host headroom; worker pools consume slots from the same budget as checks. */
export function executionBudget(
  env: Record<string, string | undefined> = verificationEnvironment(),
  cores = availableParallelism(),
  memoryBytes = totalmem()
): IExecutionBudget {
  const ci = env.CI !== undefined && env.CI !== "" && env.CI !== "false";
  const requested = Number(env.AGENT_VERIFY_PARALLEL ?? "");
  const automatic = Math.max(
    1,
    Math.min(
      ci ? 4 : 24,
      ci ? cores : cores - 2,
      Math.floor(memoryBytes / (2 * GIB))
    )
  );
  const slots =
    Number.isSafeInteger(requested) && requested > 0 ? requested : automatic;
  const requestedWorkers = Number(env.AGENT_VERIFY_TEST_WORKERS ?? "");
  const testWorkers = Math.min(
    slots,
    Number.isSafeInteger(requestedWorkers) && requestedWorkers > 0
      ? requestedWorkers
      : ci
        ? 1
        : Math.max(1, Math.min(4, Math.floor(slots / 3)))
  );

  const uiTestWorkers = Math.min(
    slots,
    Number.isSafeInteger(requestedWorkers) && requestedWorkers > 0
      ? requestedWorkers
      : ci
        ? testWorkers
        : Math.max(testWorkers, Math.min(MAX_UI_WORKERS, Math.floor(slots / 2)))
  );

  return {
    slots,
    testWorkers,
    uiTestWorkers,
    securityShards: Math.min(MAX_SHARDS, testWorkers),
    apiShards: Math.min(MAX_SHARDS, testWorkers),
  };
}
