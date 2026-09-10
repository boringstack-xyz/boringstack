/**
 * F17 — error logging has no sensitive-data boundary.
 *
 * Framework validation errors are sanitized, but generic errors go through
 * `getErrorMessage` untouched (`error-handler.ts:58`), and
 * `src/config/logger/logger.ts` configures no `redact`, no `censor` and no
 * serializers. Postgres error messages embed query parameters, and the auth
 * paths handle password hashes, token material and MFA ciphertext.
 *
 * So the boundary does not exist rather than being incomplete. Nothing here
 * claims a leak was observed in production; it asserts that a secret handed
 * to the logger does not come out the other side.
 *
 * Sentinels are synthetic and shaped like the real things they stand in for,
 * so a redaction rule matching only the literal word "password" does not
 * pass this by accident.
 */
import { describe, expect, test } from "bun:test";

import { logger } from "../src/config/logger/logger";

const SENTINELS = {
  password: "sp3c-P4ssw0rd-Sentinel",
  token: "sp3c_tok_5f4dcc3b5aa765d61d83",
  hash: "$argon2id$v=19$m=65536,t=3,p=4$c3BlYw$sp3cHashSentinel",
} as const;

/** Captures everything the logger writes for the duration of `run`. */
const captureLogs = async (
  run: () => void | Promise<void>
): Promise<string> => {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return chunks.join("");
};

describe("F17 log redaction boundary", () => {
  test("a database error carrying query parameters is redacted", async () => {
    const dbStyle = new Error(
      `Failed query: select * from auth.users where email = $1 and password = $2\nparams: user@example.com,${SENTINELS.password}`
    );

    const output = await captureLogs(() => {
      logger.error("request failed", {
        event: "request.error",
        message: dbStyle.message,
      });
    });

    expect(output).not.toContain(SENTINELS.password);
  });

  test("token material handed to the logger does not reach the output", async () => {
    const output = await captureLogs(() => {
      logger.error("session failure", {
        event: "auth.jwt.revoke_failed",
        refreshToken: SENTINELS.token,
      });
    });

    expect(output).not.toContain(SENTINELS.token);
  });

  test("a credential hash does not reach the output", async () => {
    const output = await captureLogs(() => {
      logger.error("credential failure", {
        event: "auth.login.invalid_password",
        passwordHash: SENTINELS.hash,
      });
    });

    expect(output).not.toContain(SENTINELS.hash);
  });

  test("a secret in the message text does not reach the output", async () => {
    const output = await captureLogs(() => {
      logger.error(
        `upstream rejected the statement\nparams: user@example.com,${SENTINELS.password}`
      );
    });

    /*
     * The message travels beside the context object, so a boundary that
     * only inspects context misses the single place a caught error's own
     * text lands — which is exactly where a driver puts its bound values.
     */
    expect(output).not.toContain(SENTINELS.password);
  });

  test("a child logger's bindings are redacted on every line", async () => {
    const output = await captureLogs(() => {
      const scoped = logger.child({ refreshToken: SENTINELS.token });

      scoped.info("first");
      scoped.info("second");
    });

    /*
     * Bindings are serialized once when the child is made and prepended
     * verbatim afterwards, so a per-request child leaks on every line it
     * ever writes rather than once.
     */
    expect(output).not.toContain(SENTINELS.token);
  });

  test("a subtree below the walk's depth limit is not emitted", async () => {
    let nested: Record<string, unknown> = { password: SENTINELS.password };

    for (const key of ["g", "f", "e", "d", "c", "b", "a"]) {
      nested = { [key]: nested };
    }

    const output = await captureLogs(() => {
      logger.error("deep context", {
        event: "request.error",
        ...nested,
      });
    });

    /*
     * The walk stops at a fixed depth to stay cheap on pathological input.
     * Emitting what it stopped at would publish precisely the values it
     * declined to inspect, so the subtree is replaced instead.
     */
    expect(output).not.toContain(SENTINELS.password);
  });

  test("control: ordinary diagnostic context is still logged", async () => {
    const output = await captureLogs(() => {
      logger.error("ordinary failure", {
        event: "request.error",
        route: "/api/v1/auth/login",
      });
    });

    /*
     * Redaction must not be achieved by logging nothing. If this stops
     * passing, the fix went too far and incident response loses its context.
     */
    expect(output).toContain("/api/v1/auth/login");
  });
});
