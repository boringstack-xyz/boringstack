import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sendInput } from "../agent-evals/isolated/input";
import { docker } from "../agent-evals/isolated/docker";
import { candidateOutcome } from "../agent-evals/isolated/outcome";
import { runnerArguments } from "../agent-evals/isolated/policy";
import { withIsolatedRuntime } from "../agent-evals/isolated/runtime";
import { dockerTestsEnabled, hostEnvironment } from "./environment";
import { runProcess } from "./process";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("candidate launch policy includes kernel isolation and excludes host authority", () => {
  const args = runnerArguments("candidate", "image");

  for (const required of [
    "--read-only",
    "--cap-drop",
    "--security-opt",
    "--pids-limit",
    "--memory",
    "--cpus",
  ]) {
    expect(args).toContain(required);
  }

  expect(args[args.indexOf("--network") + 1]).toBe("none");
  expect(args).not.toContain("--privileged");
  expect(args).not.toContain("--volume");
  expect(args).not.toContain("--mount");
});

test("candidate completion rejects missing, duplicated and contradictory evidence", () => {
  const checks = [
    "submission",
    "ui-known-good",
    "api.check",
    "ui.check",
    "projects.browser",
  ].map((checkId) => ({ checkId, status: "passed" }));
  const evidence = {
    schemaVersion: 1,
    kind: "candidate-review",
    status: "passed",
    checks,
  };

  expect(candidateOutcome("", 0)).toBe(2);
  expect(candidateOutcome(JSON.stringify(evidence), 0)).toBe(0);
  expect(candidateOutcome(JSON.stringify(evidence), 1)).toBe(2);
  expect(
    candidateOutcome(
      JSON.stringify({ ...evidence, checks: checks.slice(1) }),
      0
    )
  ).toBe(2);
  expect(
    candidateOutcome(
      JSON.stringify({ ...evidence, checks: [...checks, checks[0]] }),
      0
    )
  ).toBe(2);
});

test("Docker failures expose status without echoing credential arguments or stderr", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bs-docker-error-"));
  const credential = "disposable-test-credential";

  try {
    const executable = join(directory, "docker");

    writeFileSync(
      executable,
      `#!/bin/sh
if [ "$1" = "success" ]; then printf ready; exit 0; fi
printf '%s\\n' '${credential}' >&2
exit 7
`
    );
    chmodSync(executable, 0o700);
    const result = await runProcess(
      [
        process.execPath,
        "--no-env-file",
        "-e",
        `import {docker} from ${JSON.stringify(join(ROOT, "tools/agent-evals/isolated/docker.ts"))};
        console.log(await docker(${JSON.stringify(ROOT)}, ["success"]));
        try { await docker(${JSON.stringify(ROOT)}, ["run", ${JSON.stringify(credential)}]); }
        catch (error) { console.error(error.message); process.exitCode = 2; }`,
      ],
      {
        cwd: ROOT,
        env: { PATH: `${directory}:${hostEnvironment().PATH ?? ""}` },
      }
    );

    expect(result.code).toBe(2);
    expect(result.stdout.trim()).toBe("ready");
    expect(result.stderr).not.toContain(credential);
    expect(result.stderr).toContain("command_completed; exit=7");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

if (dockerTestsEnabled()) {
  test("candidate isolation denies host access and still runs the complete positive control", async () => {
    let resourceName = "";
    const input = mkdtempSync(join(tmpdir(), "bs-isolation-test-"));

    try {
      const status = await withIsolatedRuntime(
        ROOT,
        async ({ name, state }) => {
          resourceName = name;
          const probe = await docker(ROOT, [
            "exec",
            name,
            "bun",
            "-e",
            `
          import {readFileSync,existsSync,writeFileSync} from "node:fs";
          import {strict as assert} from "node:assert";
          assert.equal(process.getuid(),1000);
          assert.equal(existsSync("/var/run/docker.sock"),false);
          assert.equal(existsSync(${JSON.stringify(ROOT)}),false);
          assert.match(readFileSync("/proc/self/status","utf8"),/CapEff:\\s+0+\\n/);
          assert.match(readFileSync("/proc/self/status","utf8"),/NoNewPrivs:\\s+1/);
          assert.equal(readFileSync("/proc/net/route","utf8").trim().split("\\n").length,1);
          assert.throws(()=>writeFileSync("/review/package.json","tampered"));
          writeFileSync("/tmp/allowed","ok");
          console.log("isolated");
        `,
          ]);

          expect(probe).toBe("isolated");
          writeFileSync(join(input, "sandbox.json"), JSON.stringify(state), {
            mode: 0o644,
          });
          sendInput(name, input);
          await docker(
            ROOT,
            [
              "exec",
              name,
              "bun",
              "--no-env-file",
              "-e",
              'import {prepareControl} from "/review/tools/agent-evals/isolated/control.fixture.ts"; await prepareControl();',
            ],
            300_000
          );
          const result = await runProcess(
            [
              "docker",
              "exec",
              name,
              "bun",
              "--no-env-file",
              "/review/tools/agent-evals/isolated/worker.ts",
            ],
            { cwd: ROOT, timeoutMs: 900_000 }
          );

          expect(result.status).toBe("completed");

          if (result.code !== 0) {
            throw new Error(
              `Isolated control did not pass\n${result.stderr}\n${result.stdout.slice(-8000)}`
            );
          }

          expect(result.code).toBe(0);
          expect(candidateOutcome(result.stdout, result.code)).toBe(0);
          expect(result.stdout).toContain(
            '"kind":"candidate-review","status":"passed"'
          );

          return result.code;
        }
      );

      expect(status).toBe(0);
      expect(
        await docker(ROOT, [
          "ps",
          "-a",
          "--filter",
          `name=${resourceName}`,
          "--format",
          "{{.Names}}",
        ]).then((value) => value.trim())
      ).toBe("");
    } finally {
      rmSync(input, { recursive: true, force: true });
    }
  }, 1_800_000);
}
