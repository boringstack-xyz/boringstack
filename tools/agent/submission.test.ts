import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidateEdits } from "../agent-evals/submission";

test("candidate import excludes its tests and evaluator and refuses symlink source", () => {
  const root = mkdtempSync(join(tmpdir(), "bs-submission-"));

  try {
    mkdirSync(join(root, "apps/api/src"), { recursive: true });
    writeFileSync(join(root, "apps/api/src/example.ts"), "export const x=1;");
    const paths = [
      "apps/api/src/example.ts",
      "apps/ui/src/example.test.tsx",
      "tools/agent-evals/run.ts",
      ".github/workflows/check.yml",
    ];
    const result = candidateEdits(
      root,
      paths.map((path) => ({ path, before: null, after: "" }))
    );

    expect(result.map((plannedEdit) => plannedEdit.path)).toEqual([
      "apps/api/src/example.ts",
    ]);
    symlinkSync(
      join(root, "apps/api/src/example.ts"),
      join(root, "apps/api/src/link.ts")
    );
    expect(() =>
      candidateEdits(root, [
        { path: "apps/api/src/link.ts", before: null, after: "" },
      ])
    ).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
