import { availableParallelism } from "node:os";
import type { ICheckResult } from "./result";
import { isAborted } from "./validation";

export type Lane = () => Promise<void>;

const MIN_PARALLEL = 2;
const MAX_PARALLEL = 6;
const CORES_PER_LANE = 3;

/**
 * Each lane is a whole toolchain process (type-aware ESLint, vitest workers,
 * a Playwright run), not a single thread, so the default leaves roughly
 * three cores per lane and stays inside a modest band. `AGENT_VERIFY_PARALLEL`
 * overrides it; `1` restores strictly sequential runs.
 */
export function defaultConcurrency(
  env: Record<string, string | undefined> = process.env
): number {
  const requested = Number(env.AGENT_VERIFY_PARALLEL ?? "");

  if (Number.isInteger(requested) && requested >= 1) {
    return requested;
  }

  return Math.max(
    MIN_PARALLEL,
    Math.min(MAX_PARALLEL, Math.floor(availableParallelism() / CORES_PER_LANE))
  );
}

/**
 * Runs lanes with at most `concurrency` in flight. A lane that throws does not
 * stop the others; the first error is rethrown once every started lane has
 * settled, so partial results are never lost. An abort stops new lanes from
 * starting; running ones observe the signal themselves.
 */
export async function runLanes(
  lanes: readonly Lane[],
  concurrency: number,
  signal?: AbortSignal
): Promise<void> {
  const queue = [...lanes];
  const failures: unknown[] = [];

  const worker = async (): Promise<void> => {
    for (;;) {
      const lane = queue.shift();

      if (lane === undefined || isAborted(signal)) {
        return;
      }

      try {
        await lane();
      } catch (error) {
        failures.push(error);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  );

  if (failures.length > 0) {
    throw failures[0];
  }
}

/**
 * Lanes finish in whatever order the machine allows; reports read better in
 * the declared order. Unknown ids keep their completion order at the end.
 */
export function orderChecks(
  checks: readonly ICheckResult[],
  order: readonly string[]
): ICheckResult[] {
  const rank = new Map(order.map((id, index) => [id, index]));

  return [...checks].sort(
    (left, right) =>
      (rank.get(left.checkId) ?? order.length) -
      (rank.get(right.checkId) ?? order.length)
  );
}
