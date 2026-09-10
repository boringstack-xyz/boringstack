import { spawn } from "node:child_process";
import { isAborted } from "./validation";

export interface IProcessResult {
  code: number | null;
  status: "completed" | "blocked";
  reason: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** A bounded process group: timeout/abort also stops grandchildren. Never shell-eval argv. */
export function runProcess(
  argv: readonly string[],
  options: {
    cwd: string;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
    signal?: AbortSignal;
  }
): Promise<IProcessResult> {
  const start = performance.now();

  return new Promise((resolve) => {
    const [file, ...args] = argv;

    if (file === undefined || file === "") {
      throw new Error("Empty command");
    }

    let stdout = "",
      stderr = "",
      size = 0,
      reason = "command_completed";
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const kill = (why: string): void => {
      reason = why;

      try {
        if (child.pid !== undefined && process.platform !== "win32") {
          process.kill(-child.pid, "SIGKILL");
        } else {
          child.kill("SIGKILL");
        }
      } catch {
        /* Process may already have exited. */
      }
    };

    const abort = (): void => {
      kill("interrupted");
    };

    const timer = setTimeout(() => {
      kill("command_timeout");
    }, options.timeoutMs ?? 600_000);

    const append = (chunk: Buffer, target: "stdout" | "stderr"): void => {
      size += chunk.length;

      if (size > 32 * 1024 * 1024) {
        kill("output_limit");

        return;
      }

      if (target === "stdout") {
        stdout += chunk.toString();
      } else {
        stderr += chunk.toString();
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      append(chunk, "stdout");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      append(chunk, "stderr");
    });
    child.on("error", () => {
      reason = "spawn_error";
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);

      if (signal !== null && reason === "command_completed") {
        reason = "process_signal";
      }

      resolve({
        code,
        status: reason === "command_completed" ? "completed" : "blocked",
        reason,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - start),
      });
    });
    options.signal?.addEventListener("abort", abort, { once: true });

    if (isAborted(options.signal)) {
      abort();
    }
  });
}
