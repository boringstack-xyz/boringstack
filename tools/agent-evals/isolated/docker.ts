import { runProcess } from "../../agent/process";

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
    throw new Error(
      `Candidate sandbox Docker operation failed (${result.reason}; exit=${String(result.code)})`
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
