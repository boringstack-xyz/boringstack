/**
 * Dependency gates for the security spec suite.
 *
 * This is deliberately the inverse of `tests/helpers/db.ts`, whose documented
 * contract is that integration tests "bail silently when no Postgres is
 * reachable". That is the right call for the main suite, where a missing
 * database means "you are running unit tests on a laptop". It is the wrong
 * call here, because every test in this directory is supposed to FAIL. A
 * suite whose default posture is to opt out cannot distinguish "the finding
 * is fixed" from "nothing ran", and a green run would mean the opposite of
 * what it appears to mean.
 *
 * So: no booleans, no early returns. A missing dependency throws.
 *
 * The scale of what this is guarding against, measured on the main suite at
 * the time of writing: 440 `if (!(await requireDb())) { return; }` sites
 * across 49 of 160 test files.
 */
import { INFRA_MARKER } from "../scripts/quality/security-manifest-lib";
import { isDbAvailable } from "../tests/helpers/db";
import { isValkeyReachable } from "../tests/helpers/valkey";

const setupHint = [
  "Start the stack and re-run:",
  "  (cd ../../infra/compose/compose && ./dev.sh up -d)",
  "  bun run db:migrate",
  "  REQUIRE_INTEGRATION_DB=true RUN_VALKEY_NETWORK_TESTS=true \\",
  "    CACHE_PROVIDER=valkey bun run test:security",
].join("\n");

export const requireDbOrFail = async (): Promise<void> => {
  if (await isDbAvailable()) {
    return;
  }

  throw new Error(
    [
      `${INFRA_MARKER}: security-spec requires a real Postgres and none is reachable.`,
      "",
      "This is a failure, not a skip. These tests prove security findings;",
      "silently passing them without a database is the exact defect F18",
      "describes.",
      "",
      setupHint,
    ].join("\n")
  );
};

/*
 * `isValkeyReachable` returns false unless RUN_VALKEY_NETWORK_TESTS=true,
 * regardless of whether Valkey is actually up. CI has a Valkey service
 * container running and never sets that variable, so the three Valkey-gated
 * files in the main suite no-op in CI while Valkey sits there answering
 * pings. This gate reports which of the two reasons applies, because
 * "unreachable" and "opted out" need different fixes.
 */
export const requireValkeyOrFail = async (): Promise<void> => {
  if (await isValkeyReachable()) {
    return;
  }

  const optedOut = process.env.RUN_VALKEY_NETWORK_TESTS !== "true";

  throw new Error(
    [
      optedOut
        ? `${INFRA_MARKER}: security-spec requires Valkey, but RUN_VALKEY_NETWORK_TESTS is not 'true'.`
        : `${INFRA_MARKER}: security-spec requires Valkey and none is reachable.`,
      "",
      setupHint,
    ].join("\n")
  );
};

/*
 * Several findings (F04 attempt accounting, F12 ownerless account) are
 * read/modify/write races. Firing N promises with `Promise.all` does not
 * reliably interleave them: the reads can serialise by luck and the test
 * passes against broken code.
 *
 * `barrier(n)` holds every participant until all n have arrived, so the
 * reads provably overlap before any write lands.
 */
export const barrier = (
  participants: number
): { wait: () => Promise<void> } => {
  let arrived = 0;
  let release: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    wait: async (): Promise<void> => {
      arrived += 1;

      if (arrived >= participants) {
        release();
      }

      await gate;
    },
  };
};

/**
 * Runs `task` n times concurrently, each held at a barrier until all are
 * ready. Returns settled results so a test can assert on the mix of
 * successes and failures rather than losing everything to the first throw.
 */
export const raceAll = async <T>(
  count: number,
  task: (index: number) => Promise<T>
): Promise<PromiseSettledResult<T>[]> => {
  const gate = barrier(count);

  return Promise.allSettled(
    Array.from({ length: count }, async (_unused, index) => {
      await gate.wait();

      return task(index);
    })
  );
};

/**
 * Asserts a fixture precondition.
 *
 * Fixture problems must be distinguishable from evidence: a test that throws
 * while seeding has not proved anything about the finding it names, and the
 * manifest checker rejects any failure carrying this marker rather than
 * counting it. Two of these specs originally reported their findings as
 * "proven" purely because their fixtures blew up.
 */
export const specPrecondition: (
  condition: boolean,
  message: string
) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(`${INFRA_MARKER}: ${message}`);
  }
};
