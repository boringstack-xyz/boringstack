import { spawnSync } from "node:child_process";

/** What a program printed and how it ended. A program that cannot start has status 127. */
export interface IRunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface IRunOptions {
  readonly cwd?: string;
  readonly input?: string;
  readonly timeoutMs?: number;
  /** The whole environment the program gets; omitted, it inherits the factory's. */
  readonly env?: Readonly<Record<string, string>>;
}

/** Runs a program to its end. Injected wherever Docker or gh is called, so tests never reach them. */
export type ProcessRunner = (
  program: string,
  args: readonly string[],
  options?: IRunOptions
) => IRunResult;

const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

export const runProcess: ProcessRunner = (program, args, options = {}) => {
  const result = spawnSync(program, [...args], {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: options.timeoutMs,
  });

  if (result.error !== undefined) {
    return { status: 127, stdout: "", stderr: result.error.message };
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};
