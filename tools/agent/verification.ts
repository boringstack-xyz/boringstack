import { join } from "node:path";
import { now } from "../../apps/api/src/lib/time/now";
import { identifyCheckout } from "./checkout";
import { hostEnvironment } from "./environment";
import {
  parseEvidence,
  type ICheckResult,
  type IVerificationResult,
} from "./result";
import { isAborted } from "./validation";

/** Capture bounded evidence only. Child diagnostics may contain URLs or secrets. */
async function readBounded(
  stream: ReadableStream<Uint8Array>,
  limit: number
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  let next = await reader.read();

  while (!next.done) {
    const value = next.value;

    size += value.length;

    if (size > limit) {
      throw new Error("Report too large");
    }

    chunks.push(value);
    next = await reader.read();
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function checkOpenapi(
  root: string,
  url: string,
  timeoutMs = 30_000,
  signal?: AbortSignal
): Promise<ICheckResult> {
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new AbortController();

  const abort = (): void => {
    child?.kill("SIGKILL");
  };

  try {
    if (isAborted(signal)) {
      throw new Error("Interrupted");
    }

    signal?.addEventListener("abort", abort, { once: true });
    child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        join(root, "apps/ui/scripts/codegen/generate-api.ts"),
        "--check",
        "--json",
      ],
      {
        cwd: join(root, "apps/ui"),
        env: {
          ...hostEnvironment(),
          OPENAPI_URL: url,
          DOTENV_CONFIG_PATH: "/dev/null",
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
      }
    );
    const running = child;
    const output = running.stdout;

    timer = setTimeout(() => {
      timeout.abort();
      running.kill("SIGKILL");
    }, timeoutMs);

    if (typeof output === "number" || output === undefined) {
      throw new Error("Missing report stream");
    }

    const stdout = await readBounded(output, 16_384);
    const code = await child.exited;

    if (isAborted(timeout.signal) || isAborted(signal)) {
      return {
        checkId: "openapi.drift",
        status: "blocked",
        reason: "check_timeout",
      };
    }

    return parseEvidence(stdout, code);
  } catch {
    child?.kill("SIGKILL");

    if (child) {
      await child.exited;
    }

    return {
      checkId: "openapi.drift",
      status: "blocked",
      reason: "check_execution_error",
    };
  } finally {
    signal?.removeEventListener("abort", abort);

    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function verify(
  root: string,
  url: string,
  signal?: AbortSignal
): Promise<IVerificationResult> {
  const result: IVerificationResult = {
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    profile: "openapi",
    startedAt: now(),
    finishedAt: "",
    checkout: null,
    source: "caller-selected-api",
    status: "blocked",
    checks: [],
  };

  try {
    result.checkout = identifyCheckout(root);
    const check = await checkOpenapi(root, url, 30_000, signal);

    result.checks.push(check);
    const after = identifyCheckout(root);

    if (after.fingerprint !== result.checkout.fingerprint) {
      result.status = "blocked";
      check.status = "blocked";
      check.reason = "checkout_changed";
    } else {
      result.status = check.status;
      result.checks.push({
        checkId: "checkout.stable",
        status: "passed",
        reason: "checkout_unchanged",
      });
    }
  } catch (error) {
    result.checks.push({
      checkId: "openapi.drift",
      status: "blocked",
      reason:
        error instanceof Error && error.message === "checkout_requires_git"
          ? error.message
          : "checkout_unavailable",
    });
  }

  result.finishedAt = now();

  return result;
}
