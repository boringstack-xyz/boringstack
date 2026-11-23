import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

// Light jobs (no Docker, little CPU) run on vars.CI_LIGHT_RUNNER, which falls
// back to vars.CI_RUNNER when unset, so they never queue behind the heavy pool.
// Fork pull requests always stay on GitHub-hosted runners.
const FORK_GUARD = "!github.event.pull_request.head.repo.fork";
const dir = ".github/workflows";
const runsOn = (file: string) =>
  readFileSync(`${dir}/${file}`, "utf8")
    .split("\n")
    .filter((line) => /^\s*runs-on:/.test(line));

const LIGHT = [
  "security-secrets.yml",
  "apps-api-security-deps.yml",
  "apps-docs-security-deps.yml",
  "apps-site-security-deps.yml",
  "apps-ui-security-deps.yml",
  "infra-bootstrap-security-deps.yml",
  "infra-bootstrap-validate.yml",
  "infra-k3s-validate.yml",
  "infra-compose-validate-compose.yml",
  "merge-gate.yml",
];

test("light jobs run on the light pool, with the fork guard", () => {
  for (const file of LIGHT) {
    const lines = runsOn(file).filter((line) => line.includes("CI_LIGHT_RUNNER"));
    expect(lines.length, file).toBeGreaterThan(0);
    for (const line of lines) expect(line.includes(FORK_GUARD), file).toBe(true);
  }
});

test("every self-hosted runner switch carries the fork guard", () => {
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".yml"))) {
    for (const line of runsOn(file)) {
      if (line.includes("vars.CI_RUNNER") || line.includes("vars.CI_LIGHT_RUNNER")) {
        expect(line.includes(FORK_GUARD), file).toBe(true);
      }
    }
  }
});
