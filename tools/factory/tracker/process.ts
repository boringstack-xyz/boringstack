import { spawnSync } from "node:child_process";

/*
 * Runs an external program (gh, bash) without a shell. Injected everywhere a
 * command talks to GitHub, so tests never reach the network.
 */
export interface IProcessResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface IProcessOptions {
  readonly cwd?: string;
  readonly input?: string;
}

export type IProcessRunner = (
  command: string,
  args: readonly string[],
  options?: IProcessOptions
) => IProcessResult;

export const runProcess: IProcessRunner = (command, args, options) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    cwd: options?.cwd,
    input: options?.input,
  });
  // A program that cannot start has no status or output; the error says why.
  const maybe: {
    status: number | null;
    stdout: string | null;
    stderr: string | null;
  } = { status: result.status, stdout: result.stdout, stderr: result.stderr };

  return {
    status: maybe.status ?? 1,
    stdout: maybe.stdout ?? "",
    stderr: result.error?.message ?? maybe.stderr ?? "",
  };
};

/** A failed program call, with its own words for the person. */
export const mustSucceed = (
  what: string,
  result: IProcessResult
): IProcessResult => {
  if (result.status !== 0) {
    const errors = result.stderr.trim();
    const words = errors === "" ? result.stdout.trim() : errors;

    throw new Error(`${what} failed: ${words}`);
  }

  return result;
};
