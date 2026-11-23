import { describe, expect, test } from "bun:test";

import { FACTORY_CONFIG } from "../factory.config";
import {
  cpuOf,
  derivedStatus,
  healthOf,
  parseContainers,
  parseLabels,
  parseStats,
  portsOf,
  summarizeStack,
  usedMiB,
  type IContainer,
} from "./fleet.utils";

const line = (value: Record<string, string>): string => JSON.stringify(value);

const container = (overrides: Partial<IContainer>): IContainer => ({
  name: "boringstack-s1-api-1",
  project: "boringstack-s1",
  service: "api",
  workingDir: "/work/s1",
  state: "running",
  status: "Up 2 minutes (healthy)",
  ports: "",
  ...overrides,
});

describe("fleet parsing", () => {
  test("labels split on commas, keeping = inside values", () => {
    expect(parseLabels("a=1,b=x=y,,=bad")).toEqual({ a: "1", b: "x=y" });
  });

  test("docker ps lines become containers of a compose project only", () => {
    const output = [
      line({
        Names: "boringstack-s1-api-1",
        State: "running",
        Status: "Up (healthy)",
        Ports: "",
        Labels:
          "com.docker.compose.project=boringstack-s1,com.docker.compose.service=api,com.docker.compose.project.working_dir=/work/s1",
      }),
      line({ Names: "loose", State: "running", Status: "Up", Labels: "" }),
      "not json",
    ].join("\n");

    expect(parseContainers(output)).toEqual([
      {
        name: "boringstack-s1-api-1",
        project: "boringstack-s1",
        service: "api",
        workingDir: "/work/s1",
        state: "running",
        status: "Up (healthy)",
        ports: "",
      },
    ]);
  });

  test("memory reads in MiB whatever the unit", () => {
    expect(usedMiB("319.7MiB / 768MiB")).toBeCloseTo(319.7);
    expect(usedMiB("1GiB / 4GiB")).toBe(1024);
    expect(usedMiB("512KiB / 1GiB")).toBeCloseTo(0.5);
    expect(usedMiB("nonsense")).toBe(0);
  });

  test("CPU that does not read counts as zero", () => {
    expect(cpuOf("12.5%")).toBe(12.5);
    expect(cpuOf("--")).toBe(0);
  });

  test("stats lines carry memory and CPU per container", () => {
    const output = line({
      Name: "a",
      MemUsage: "100MiB / 1GiB",
      CPUPerc: "3.25%",
    });

    expect(parseStats(output)).toEqual([
      { name: "a", memoryMiB: 100, cpuPercent: 3.25 },
    ]);
  });
});

describe("health", () => {
  test("a health check reads through the status text", () => {
    expect(healthOf(container({ status: "Up (healthy)" }))).toBe("healthy");
    expect(healthOf(container({ status: "Up (unhealthy)" }))).toBe("unhealthy");
    expect(healthOf(container({ status: "Up (health: starting)" }))).toBe(
      "starting"
    );
    expect(healthOf(container({ status: "Up 3 minutes" }))).toBe("running");
    expect(healthOf(container({ state: "restarting" }))).toBe("restarting");
    expect(healthOf(container({ state: "exited", status: "Exited (1)" }))).toBe(
      "exited"
    );
  });

  test("the plain status line says what is wrong", () => {
    expect(derivedStatus([{ service: "api", health: "healthy" }], [])).toBe(
      "Running: all 1 services up."
    );
    expect(
      derivedStatus(
        [
          { service: "api", health: "unhealthy" },
          { service: "ui", health: "healthy" },
        ],
        ["api"]
      )
    ).toBe("Needs attention: api not healthy.");
    expect(
      derivedStatus(
        [
          { service: "api", health: "exited" },
          { service: "ui", health: "healthy" },
        ],
        []
      )
    ).toBe("Partly stopped: 1 of 2 services running.");
    expect(derivedStatus([], [])).toBe("No services are running.");
  });
});

describe("ports and summaries", () => {
  test("slot N publishes each service on its base plus N", () => {
    expect(portsOf(3)).toEqual({
      ui: FACTORY_CONFIG.portBases.ui + 3,
      api: FACTORY_CONFIG.portBases.api + 3,
      postgres: FACTORY_CONFIG.portBases.postgres + 3,
      valkey: FACTORY_CONFIG.portBases.valkey + 3,
    });
  });

  test("a stack summary joins its containers, claim, status and verify", () => {
    const summary = summarizeStack({
      slot: 2,
      containers: [
        container({ name: "a", service: "api", status: "Up (healthy)" }),
        container({ name: "b", service: "ui", status: "Up (unhealthy)" }),
      ],
      stats: [
        { name: "a", memoryMiB: 100, cpuPercent: 1 },
        { name: "b", memoryMiB: 50, cpuPercent: 2 },
        { name: "other", memoryMiB: 999, cpuPercent: 9 },
      ],
      claim: {
        slot: 2,
        workspace: "/work/s2",
        issue: "APP-1",
        branch: "factory/app-1",
        claimedAt: null,
      },
      status: { text: "Waiting on a review", at: "2026-11-23T10:00:00Z" },
      previewUrl: "https://s2.preview.localhost",
      lastVerify: { ok: true, level: null, runId: "20261123-100000", at: null },
    });

    expect(summary.project).toBe("boringstack-s2");
    expect(summary.issue).toBe("APP-1");
    expect(summary.plainStatus).toBe("Waiting on a review");
    expect(summary.running).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.unhealthy).toEqual(["ui"]);
    expect(summary.memoryMiB).toBe(150);
    expect(summary.cpuPercent).toBe(3);
    expect(summary.uiUrl).toBe(
      `http://127.0.0.1:${String(FACTORY_CONFIG.portBases.ui + 2)}`
    );
    expect(summary.previewUrl).toBe("https://s2.preview.localhost");
  });

  test("with no status file the plain line comes from the containers", () => {
    const summary = summarizeStack({
      slot: 1,
      containers: [container({ status: "Up (unhealthy)" })],
      stats: [],
      claim: null,
      status: null,
      previewUrl: null,
      lastVerify: null,
    });

    expect(summary.plainStatus).toBe("Needs attention: api not healthy.");
    expect(summary.workspace).toBeNull();
  });
});
