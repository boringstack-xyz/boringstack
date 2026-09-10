/**
 * F18 — dependency exceptions never expire.
 *
 * `osv-scanner.toml` carries `ignoreUntil = "2026-11-18T00:00:00Z"` on both
 * accepted-risk entries, and the file header instructs that each entry
 * "must include the reasoning + a re-evaluation date".
 *
 * `scripts/ci/bun-audit.sh` extracts ids with
 *
 *   grep -E '^id = "' "$CONFIG" | sed -E ...capture the id...
 *
 * and never reads `ignoreUntil`. The dates are decorative: both advisories
 * stay suppressed indefinitely after they lapse.
 *
 * Tested behaviourally rather than by grepping the script, so any correct
 * implementation passes. A stub `bun` on PATH captures the arguments the
 * script would have passed to the real `bun audit`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = new URL("../scripts/ci/bun-audit.sh", import.meta.url).pathname;

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const entry = (id: string, until: string): string => `
[[IgnoredVulns]]
id = "${id}"
ignoreUntil = "${until}"
reason = """
spec fixture
"""
`;

/**
 * Lays out a throwaway tree matching the script's own `ROOT` derivation
 * (`dirname $0/../..`), drops a stub `bun` on PATH, and returns the
 * arguments the script tried to hand to `bun audit`.
 */
const ignoresPassedTo = async (config: string): Promise<string[]> => {
  const root = mkdtempSync(join(tmpdir(), "bs-audit-spec-"));

  created.push(root);

  mkdirSync(join(root, "scripts", "ci"), { recursive: true });
  copyFileSync(SCRIPT, join(root, "scripts", "ci", "bun-audit.sh"));
  chmodSync(join(root, "scripts", "ci", "bun-audit.sh"), 0o755);
  writeFileSync(join(root, "osv-scanner.toml"), config);

  const binDir = join(root, "stub-bin");

  mkdirSync(binDir);
  const stub = join(binDir, "bun");

  writeFileSync(
    stub,
    '#!/usr/bin/env bash\nfor a in "$@"; do echo "$a"; done\n'
  );
  chmodSync(stub, 0o755);

  const proc = Bun.spawn(
    ["bash", join(root, "scripts", "ci", "bun-audit.sh")],
    {
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const out = await new Response(proc.stdout).text();

  await proc.exited;

  return out
    .split("\n")
    .filter((line) => line.startsWith("--ignore="))
    .map((line) => line.slice("--ignore=".length));
};

describe("F18 audit exceptions expire", () => {
  test("an expired ignoreUntil no longer suppresses the advisory", async () => {
    const ignores = await ignoresPassedTo(
      entry("GHSA-expired-0000-0000", "2020-01-01T00:00:00Z")
    );

    expect(ignores).not.toContain("GHSA-expired-0000-0000");
  });

  test("control: a future ignoreUntil still suppresses", async () => {
    const ignores = await ignoresPassedTo(
      entry("GHSA-future-0000-0000", "2999-01-01T00:00:00Z")
    );

    expect(ignores).toContain("GHSA-future-0000-0000");
  });

  test("an entry with no ignoreUntil at all is not silently honoured", async () => {
    const ignores = await ignoresPassedTo(
      '\n[[IgnoredVulns]]\nid = "GHSA-undated-0000-0000"\nreason = """\nspec fixture\n"""\n'
    );

    // The file header requires a re-evaluation date on every entry.
    expect(ignores).not.toContain("GHSA-undated-0000-0000");
  });
});
