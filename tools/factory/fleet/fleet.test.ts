import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fleetResponse, fleetStatus } from "./fleet";
import { renderTable } from "./fleet.format";
import { escapeHtml, renderFleetPage } from "./fleet.page";
import { fakeRunner, contextAt, tempDir } from "./fleet.test-helpers";
import type { IStackSummary } from "./fleet.utils";

const psLine = (
  name: string,
  project: string,
  service: string,
  status: string
): string =>
  JSON.stringify({
    Names: name,
    State: "running",
    Status: status,
    Ports: "",
    Labels: `com.docker.compose.project=${project},com.docker.compose.service=${service},com.docker.compose.project.working_dir=/work/s1`,
  });

const stackRunner = () =>
  fakeRunner((program, args) => {
    if (program !== "docker") {
      return undefined;
    }

    if (args[0] === "ps") {
      return {
        status: 0,
        stdout: [
          psLine(
            "boringstack-s1-api-1",
            "boringstack-s1",
            "api",
            "Up (healthy)"
          ),
          psLine(
            "boringstack-s1-ui-1",
            "boringstack-s1",
            "ui",
            "Up (unhealthy)"
          ),
          psLine("tinkercaster-api-1", "tinkercaster", "api", "Up (healthy)"),
        ].join("\n"),
        stderr: "",
      };
    }

    if (args[0] === "stats") {
      return {
        status: 0,
        stdout: JSON.stringify({
          Name: "boringstack-s1-api-1",
          MemUsage: "200MiB / 1GiB",
          CPUPerc: "4%",
        }),
        stderr: "",
      };
    }

    return undefined;
  });

describe("factory fleet", () => {
  test("an empty machine is an empty fleet, not a failure", () => {
    const context = contextAt(tempDir("fleet-empty"), tempDir("shared-empty"));
    const outcome = fleetStatus(
      context,
      fakeRunner((program, args) =>
        program === "docker" && args[0] === "ps"
          ? { status: 0, stdout: "", stderr: "" }
          : undefined
      ).run
    );

    expect(outcome.code).toBe(0);
    expect(outcome.data).toEqual({ stacks: [] });
    expect(outcome.summary).toBe(
      "No factory stacks are running on this machine."
    );
  });

  test("docker that cannot be reached is blocked, not an empty fleet", () => {
    const context = contextAt(tempDir("fleet-down"), tempDir("shared-down"));
    const outcome = fleetStatus(
      context,
      fakeRunner(() => ({ status: 1, stdout: "", stderr: "cannot connect" }))
        .run
    );

    expect(outcome.code).toBe(2);
    expect(outcome.data).toMatchObject({ reason: "docker_unavailable" });
  });

  test("stacks join their containers with the shared claim, status and verify", () => {
    const root = tempDir("fleet-root");
    const shared = tempDir("fleet-shared");
    const context = contextAt(root, shared);

    mkdirSync(join(shared, "slots"), { recursive: true });
    mkdirSync(join(shared, "status"), { recursive: true });
    writeFileSync(
      join(shared, "slots", "s1.json"),
      JSON.stringify({ workspace: root, issue: "APP-42" })
    );
    writeFileSync(
      join(shared, "status", "s1.json"),
      JSON.stringify({ status: "Fixing the login", updatedAt: "t" })
    );
    mkdirSync(join(root, ".agent-state", "factory", "verify"), {
      recursive: true,
    });
    writeFileSync(
      join(root, ".agent-state", "factory", "verify", "latest.json"),
      JSON.stringify({ status: "passed", runId: "20261123-100000" })
    );

    const outcome = fleetStatus(context, stackRunner().run);

    expect(outcome.code).toBe(0);
    expect(outcome.data).toMatchObject({
      stacks: [
        {
          slot: 1,
          issue: "APP-42",
          plainStatus: "Fixing the login",
          running: 1,
          total: 2,
          unhealthy: ["ui"],
          lastVerify: { ok: true, runId: "20261123-100000" },
        },
      ],
    });
    expect(outcome.summary).toContain("APP-42");
    expect(outcome.summary).toContain("pass 20261123-100000");
    expect(outcome.summary).not.toContain("tinkercaster");
  });

  test("the page escapes what agents wrote", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;"
    );

    const context = contextAt(tempDir("fleet-page"), tempDir("shared-page"));
    const page = renderFleetPage({
      stacks: [],
      generatedAt: "now",
      dockerAvailable: true,
    });
    const response = fleetResponse("/", () => ({
      dockerAvailable: true,
      stacks: [],
    }));

    expect(page).toContain("No factory stacks are running");
    expect(page).toContain('http-equiv="refresh"');
    expect(context.sharedDir).toBeTruthy();
    expect(response.status).toBe(200);
    expect(
      fleetResponse("/nope", () => ({ dockerAvailable: true, stacks: [] }))
        .status
    ).toBe(404);
  });

  test("a stack's address and status are escaped in the table and the page", () => {
    const stack: IStackSummary = {
      project: "boringstack-s2",
      slot: 2,
      workspace: null,
      issue: "<b>APP-2</b>",
      branch: null,
      plainStatus: "<script>x</script>",
      statusAt: null,
      services: [],
      running: 0,
      total: 0,
      unhealthy: [],
      memoryMiB: 0,
      cpuPercent: 0,
      ports: { ui: 7402, api: 7502, postgres: 7602, valkey: 7702 },
      uiUrl: "http://127.0.0.1:7402",
      previewUrl: null,
      lastVerify: null,
    };

    expect(renderTable([stack])).toContain("<b>APP-2</b>");
    const page = renderFleetPage({
      stacks: [stack],
      generatedAt: "now",
      dockerAvailable: true,
    });

    expect(page).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(page).not.toContain("<script>x");
  });
});
