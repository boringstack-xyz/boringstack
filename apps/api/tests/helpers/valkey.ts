import { Socket } from "node:net";
import { env } from "../../src/config/env";

const PROBE_TIMEOUT_MS = 500;
const RUN_VALKEY_NETWORK_TESTS =
  process.env.RUN_VALKEY_NETWORK_TESTS === "true";

let availability: boolean | null = null;

const probeHost = (): string =>
  env.VALKEY_HOST === "localhost" ? "127.0.0.1" : env.VALKEY_HOST;

const canOpenTcpConnection = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (available: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => {
      finish(true);
    });
    socket.once("timeout", () => {
      finish(false);
    });
    socket.once("error", () => {
      finish(false);
    });
    socket.connect({ host: probeHost(), port: env.VALKEY_PORT });
  });
};

export const isValkeyReachable = async (): Promise<boolean> => {
  if (!RUN_VALKEY_NETWORK_TESTS) {
    return false;
  }

  if (availability !== null) {
    return availability;
  }

  availability = await canOpenTcpConnection();

  return availability;
};

/**
 * Skip-guard for Valkey-touching tests (cache, pubsub, SSE, OAuth state,
 * health checks). Mirrors `requireDb()`: returns true when the probe
 * succeeds, otherwise logs a single skip notice and returns false. Set
 * `REQUIRE_INTEGRATION_VALKEY=true` to fail hard instead of skipping.
 *
 *   test("publishes to a channel", async () => {
 *     if (!(await requireValkey())) return;
 *     // ...real assertions
 *   });
 *
 * Note: the underlying probe is gated on `RUN_VALKEY_NETWORK_TESTS=true`;
 * leaving that unset skips the probe entirely and returns false here.
 */
let warnedAboutSkip = false;

export const requireValkey = async (): Promise<boolean> => {
  if (await isValkeyReachable()) {
    return true;
  }

  if (process.env.REQUIRE_INTEGRATION_VALKEY === "true") {
    throw new Error("Integration Valkey is required but unreachable");
  }

  if (!warnedAboutSkip) {
    console.log(
      "(valkey-dependent tests skipped — set RUN_VALKEY_NETWORK_TESTS=true and ensure VALKEY_HOST is reachable)"
    );
    warnedAboutSkip = true;
  }

  return false;
};
