import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("root check distinguishes an unavailable OpenAPI gate from success and real failure", () => {
  const root = mkdtempSync(join(tmpdir(), "bs-stack-check-"));

  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    mkdirSync(join(root, "apps/api"), { recursive: true });
    mkdirSync(join(root, "apps/ui"), { recursive: true });

    for (const name of ["stack-check.sh", "stack-lib.sh"]) {
      cpSync(
        join(import.meta.dir, "../../scripts", name),
        join(root, "scripts", name)
      );
    }

    for (const [available, commandExit, expected] of [
      [false, 0, 2],
      [true, 0, 0],
      [false, 1, 1],
    ] as const) {
      writeFileSync(
        join(root, "bin/curl"),
        `#!/bin/bash\nexit ${available ? "0" : "1"}\n`,
        { mode: 0o755 }
      );
      writeFileSync(
        join(root, "bin/bun"),
        `#!/bin/bash\nexit ${String(commandExit)}\n`,
        { mode: 0o755 }
      );
      const result = spawnSync(
        "/bin/bash",
        [join(root, "scripts/stack-check.sh")],
        {
          env: { PATH: `${join(root, "bin")}:/usr/bin:/bin` },
          encoding: "utf8",
        }
      );

      expect(result.status).toBe(expected);
    }

    expect(
      execFileSync("/bin/bash", ["-n", join(root, "scripts/stack-check.sh")])
        .length
    ).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
