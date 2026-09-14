import { runProcess } from "../../agent/process";

const STDERR_TAIL_CHARS = 600;
const MIN_REDACTED_LENGTH = 8;

/**
 * Docker arguments carry credentials (`-e POSTGRES_PASSWORD=…`, `-a …`), and
 * a failing command may echo them. Every argument value long enough to be a
 * secret is removed from the tail before it reaches a log, so the error can
 * say what Docker said without repeating what it was given.
 */
function redactedTail(stderr: string, args: readonly string[]): string {
  let tail = stderr.trim().slice(-STDERR_TAIL_CHARS);

  for (const arg of args) {
    for (const value of [arg, ...arg.split("=")]) {
      if (value.length >= MIN_REDACTED_LENGTH) {
        tail = tail.split(value).join("[redacted]");
      }
    }
  }

  return tail.replace(/\s+/g, " ");
}

export async function docker(
  root: string,
  args: string[],
  timeoutMs = 120_000
): Promise<string> {
  const result = await runProcess(["docker", ...args], {
    cwd: root,
    timeoutMs,
  });

  if (result.status !== "completed" || result.code !== 0) {
    const tail = redactedTail(result.stderr, args);
    const detail = tail === "" ? "" : `; stderr: ${tail}`;

    throw new Error(
      `Candidate sandbox Docker operation failed (${result.reason}; exit=${String(result.code)}; docker ${args[0] ?? ""}${detail})`
    );
  }

  return result.stdout.trim();
}

/** A partially created run may have no container; other cleanup failures remain visible. */
export async function removeContainer(
  root: string,
  name: string
): Promise<void> {
  const result = await runProcess(["docker", "rm", "-f", "-v", name], {
    cwd: root,
    timeoutMs: 120_000,
  });

  if (
    result.status !== "completed" ||
    (result.code !== 0 && !result.stderr.includes("No such container"))
  ) {
    throw new Error(`Candidate container cleanup failed: ${name}`);
  }
}
