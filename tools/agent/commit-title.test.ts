import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../../scripts/ci/check-commit-title.sh", import.meta.url)
);

const check = (...args: string[]): number =>
  spawnSync("/bin/bash", [script, ...args], { encoding: "utf8" }).status ?? -1;

const checkWithMax = (max: string, title: string): number =>
  spawnSync("/bin/bash", [script, title], {
    encoding: "utf8",
    env: { ...process.env, COMMIT_TITLE_MAX_LENGTH: max },
  }).status ?? -1;

test("conventional titles pass", () => {
  for (const title of [
    "feat(api): invoices can be voided",
    "fix: keep the session after refresh",
    "feat(k3s)!: pin every image digest in one release commit",
    "chore(deps): bump elysia",
    "fixup! feat(api): invoices can be voided",
    'Revert "feat(api): invoices can be voided"',
  ]) {
    expect(check(title)).toBe(0);
  }
});

test("prose, unknown types and overlong titles fail", () => {
  for (const title of [
    "Homepage leads with the product demo video (#77)",
    "feature(api): invoices",
    "feat(API): uppercase scope",
    "feat:missing space",
    "",
    `feat: ${"x".repeat(100)}`,
  ]) {
    expect(check(title)).toBe(1);
  }
});

test("message files are read from their first non-comment line", () => {
  const dir = mkdtempSync(join(tmpdir(), "commit-title-"));

  try {
    const good = join(dir, "good");

    writeFileSync(good, "# comment\n\nfix(ui): label contrast\n\nBody.\n");
    const bad = join(dir, "bad");

    writeFileSync(bad, "Fix the label contrast\n");
    expect(check("--file", good)).toBe(0);
    expect(check("--file", bad)).toBe(1);
    expect(check("--file", join(dir, "missing"))).toBe(2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the length limit can be raised for generated titles, but not bypassed", () => {
  const long =
    "chore(docker): bump nginx from `72ba65e` to `df221db` in /apps/ui in the docker-images group across 1 directory";

  expect(check(long)).toBe(1);
  expect(checkWithMax("200", long)).toBe(0);
  expect(checkWithMax("200", "chore(deps)(deps-dev): bump the group")).toBe(1);
  expect(checkWithMax("nope", long)).toBe(2);
});
