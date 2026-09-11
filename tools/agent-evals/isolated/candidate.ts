import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { planAccountResource } from "../../agent/generate/account-resource";
import { planReferenceUi } from "../../agent/generate/reference-ui";
import { runProcess } from "../../agent/process";
import { candidateEdits, migrationEdits } from "../submission";
import { candidateOutcome } from "./outcome";
import { sendInput } from "./input";
import { withIsolatedRuntime } from "./runtime";

/** Copy only declared source bytes, never candidate dependencies, scripts, configuration or symlinks. */
export function stageCandidate(
  root: string,
  candidate: string,
  destination: string
): void {
  const edits = [
    ...candidateEdits(
      candidate,
      planAccountResource(root, "Projects", "team-read-admin-write")
    ),
    ...candidateEdits(candidate, planReferenceUi(root)),
    ...migrationEdits(root, candidate),
  ];

  if (
    edits.length > 1000 ||
    edits.reduce(
      (bytes, plannedEdit) => bytes + Buffer.byteLength(plannedEdit.after),
      0
    ) >
      32 * 1024 * 1024
  ) {
    throw new Error("Candidate exceeds submission budget");
  }

  for (const plannedEdit of edits) {
    const path = join(destination, plannedEdit.path);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, plannedEdit.after, { mode: 0o644 });
  }
}

export async function runIsolatedCandidate(
  root: string,
  candidate: string
): Promise<number> {
  const input = mkdtempSync(join(tmpdir(), "bs-candidate-input-"));

  try {
    stageCandidate(root, candidate, join(input, "candidate"));

    return await withIsolatedRuntime(root, async ({ name, state }) => {
      writeFileSync(join(input, "sandbox.json"), JSON.stringify(state), {
        mode: 0o644,
      });
      sendInput(name, input);
      const result = await runProcess(
        [
          "docker",
          "exec",
          name,
          "bun",
          "--no-env-file",
          "/review/tools/agent-evals/isolated/worker.ts",
        ],
        { cwd: root, timeoutMs: 900_000 }
      );

      if (result.status !== "completed") {
        throw new Error("Isolated candidate execution did not complete");
      }

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);

      return candidateOutcome(result.stdout, result.code);
    });
  } finally {
    rmSync(input, { recursive: true, force: true });
  }
}
