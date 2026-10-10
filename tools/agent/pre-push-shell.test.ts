import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/*
 * Hooks run under `set -o pipefail`. `echo "$BIG" | grep -q` exits as soon as
 * grep matches, echo then takes SIGPIPE (141), and pipefail turns the whole
 * `if` into "no match": the gate is skipped silently. A here-string has no
 * writer process to kill, so the same input matches.
 */
test("grep -q on a large changed-path list does not lose matches under pipefail", () => {
  const script = [
    "set -euo pipefail",
    "CHANGED_PATHS=\"$(seq 1 200000 | sed 's#^#apps/api/src/file-#')\"",
    'if echo "$CHANGED_PATHS" | grep -qE "^apps/api/"; then echo old-match; else echo "old-status=$?"; fi',
    'if grep -qE "^apps/api/" <<< "$CHANGED_PATHS"; then echo new-match; else echo new-nomatch; fi',
  ].join("\n");
  const result = spawnSync("/bin/bash", ["-c", script], { encoding: "utf8" });

  expect(result.stdout).toContain("new-match");
  expect(result.stdout).toContain("old-status=141");
});

function shellScripts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return shellScripts(path);
    }

    return entry.name.endsWith(".sh") ? [path] : [];
  });
}

test("hook and gate scripts use here-strings instead of echo | grep -q", () => {
  const dirs = [
    join(ROOT, "scripts"),
    join(ROOT, "infra/compose/scripts"),
    join(ROOT, "tools/agent"),
  ];
  const offenders = dirs
    .flatMap(shellScripts)
    .filter((file) =>
      /(?:echo|printf)\b[^|\n]*\|\s*grep\s+-[a-zA-Z]*q/u.test(
        readFileSync(file, "utf8")
      )
    );

  expect(offenders).toEqual([]);
});

test("the root pre-push hook clears inherited git environment before any gate runs", () => {
  const lines = readFileSync(
    join(ROOT, "scripts/ci/pre-push.sh"),
    "utf8"
  ).split("\n");
  const unsetIndex = lines.findIndex((line) =>
    /^unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR$/u.test(
      line
    )
  );
  const firstGateIndex = lines.findIndex((line) =>
    /^(bash|run_app_gate|step "Root)/u.test(line)
  );

  expect(unsetIndex).toBeGreaterThan(-1);
  expect(unsetIndex).toBeLessThan(firstGateIndex);
});

test("the root pre-push hook is fast by default and FULL_PREPUSH=1 reaches the full gate", () => {
  const script = readFileSync(join(ROOT, "scripts/ci/pre-push.sh"), "utf8");
  const fastGuard = script.indexOf(
    'if [[ "${FULL_PREPUSH:-0}" != "1" ]]; then'
  );
  const secretsOnly = script.indexOf('pre-push-security.sh" --secrets-only');
  const fastExit = script.indexOf("  exit 0\nfi", fastGuard);
  const fullSecurity = script.indexOf(
    'bash "$ROOT/scripts/ci/pre-push-security.sh"\n'
  );
  const security = readFileSync(
    join(ROOT, "scripts/ci/pre-push-security.sh"),
    "utf8"
  );

  expect(fastGuard).toBeGreaterThan(-1);
  expect(secretsOnly).toBeGreaterThan(fastGuard);
  expect(fastExit).toBeGreaterThan(secretsOnly);
  expect(fullSecurity).toBeGreaterThan(fastExit);
  expect(security.indexOf('"--secrets-only"')).toBeGreaterThan(
    security.indexOf("gitleaks clean")
  );
});
