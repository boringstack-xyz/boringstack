/**
 * F13 — notification side effects are detached without a rejection handler.
 *
 * `error-handlers.ts:98-117` installs an `unhandledRejection` handler that
 * calls `process.exit(1)` when `NODE_ENV === "production"`. Several business
 * paths dispatch notifications with a bare `void`:
 *
 *   src/api/auth/services/email-verification.service.ts:122
 *   src/api/auth/services/oauth.service.ts:149
 *   src/api/auth/services/password-reset.service.ts:216
 *   src/api/accounts/ownership-transfers.service.ts:272
 *   src/api/accounts/invitations.service.ts:324
 *
 * `void` discards the promise without attaching a handler, and
 * `NotificationDispatcher.send` genuinely rejects — on schema validation
 * (`notifications.dispatcher.ts:52`) and on inline dispatch failure (`:88`).
 * So a queue or Valkey failure after an already-committed mutation becomes an
 * unhandled rejection, and in production that terminates the process: a
 * dependency blip turned into an outage, after the user's write succeeded.
 *
 * Why a child process
 * -------------------
 * Neither half of this is observable from inside the runner. Bun intercepts
 * unhandled rejections itself and attributes them to whichever test is in
 * flight, so a `process.on("unhandledRejection")` listener never sees one; and
 * the production handler's `process.exit(1)` would take the runner down. The
 * behaviour is therefore exercised in a separate NODE_ENV=production process
 * and asserted on its exit code.
 *
 * Scope: this covers the process-death half of F13. The outbox, dedup and
 * audit-durability sub-findings in the original report are not covered here
 * and still need their own tests.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Glob } from "bun";

import { cleanDatabase } from "../tests/helpers/db";
import { requireDbOrFail, specPrecondition } from "./harness";

const SRC = new URL("../src/", import.meta.url).pathname;

const CHILD = new URL(
  "./fixtures/f13-detached-dispatch-child.ts",
  import.meta.url
).pathname;

/** Strips block and line comments so documentation examples are not scanned. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Runs the dispatch in a separate production-mode process and returns its exit
 * code. `NOTIFICATIONS_FAIL` selects whether the dispatcher is made to reject.
 */
interface IChildRun {
  readonly exitCode: number;
  readonly output: string;
}

/**
 * Runs the dispatch in a separate process so the runner's own unhandled
 * rejection interception cannot mask the result, and returns what the real
 * error handler logged.
 */
const runChild = async (
  email: string,
  extraEnv: Record<string, string>
): Promise<IChildRun> => {
  const proc = Bun.spawn(["bun", "run", CHILD, email], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, LOG_LEVEL: "error", ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const output = `${stdout}\n${stderr}`;

  specPrecondition(
    !output.includes("Invalid environment configuration"),
    `the child could not boot: ${output.slice(0, 400)}`
  );

  return { exitCode, output };
};

beforeEach(async () => {
  await requireDbOrFail();
  await cleanDatabase();
});

describe("F13 detached side effects", () => {
  test("a failing notification does not escape as an unhandled rejection", async () => {
    const { output } = await runChild("f13-failing@gmail.com", {
      NOTIFICATIONS_FAIL: "true",
    });

    /*
     * This marker is written by `error-handlers.ts:99`, immediately before
     * the branch that calls `process.exit(1)` in production. Seeing it means
     * a committed signup has left a rejection loose in the process.
     */
    expect(output).not.toContain("unhandled_rejection");
  }, 60_000);

  test("control: a healthy dispatch leaves nothing loose", async () => {
    const { exitCode, output } = await runChild("f13-healthy@gmail.com", {});

    /*
     * Same script, same environment, only the injected failure removed. If
     * this fails the harness is broken and the assertion above proves
     * nothing.
     */
    expect(output).not.toContain("unhandled_rejection");
    expect(exitCode).toBe(0);
  }, 60_000);

  test("no notification dispatch is left without a rejection handler", async () => {
    const offenders: string[] = [];

    for await (const rel of new Glob("**/*.ts").scan({ cwd: SRC })) {
      const lines = withoutComments(await Bun.file(SRC + rel).text()).split(
        "\n"
      );

      lines.forEach((line, index) => {
        if (!line.includes("void notifications.send(")) {
          return;
        }

        /*
         * The dispatch spans several lines, so look ahead for the handler
         * rather than requiring it on the same one.
         */
        const window = lines.slice(index, index + 12).join("\n");

        if (!window.includes(".catch(")) {
          offenders.push(`${rel}:${index + 1}`);
        }
      });
    }

    expect(offenders).toBeEmpty();
  });
});
