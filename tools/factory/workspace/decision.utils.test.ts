import { describe, expect, test } from "bun:test";

import { plainProblems } from "./status.utils";
import { decideSweep } from "./sweep.utils";
import {
  bunCheck,
  freeBytesFromDf,
  freeDiskCheck,
  nodeCheck,
  requiredNode,
  compareVersions,
} from "./doctor.utils";
import { configProblems } from "./compose-policy.utils";
import { routesConf } from "./preview.utils";
import { parseArgs, isParseError } from "./args.utils";
import { slotEnvFileText, slotComposeArgs } from "./compose.utils";

describe("sweep decisions", () => {
  const noFolders: boolean[] = [];
  const base = {
    claimed: false,
    workspaceExists: true,
    stackExists: false,
    stackFoldersExist: noFolders,
  };

  test("a claim whose workspace folder is gone is removed with its stack", () => {
    const [action] = decideSweep([
      {
        ...base,
        slot: 1,
        claimed: true,
        workspaceExists: false,
        stackExists: true,
        stackFoldersExist: [false],
      },
    ]);

    expect(action?.kind).toBe("remove");
  });

  test("a live workspace is kept, even with an old stack", () => {
    const [action] = decideSweep([
      {
        ...base,
        slot: 2,
        claimed: true,
        workspaceExists: true,
        stackExists: true,
        stackFoldersExist: [false],
      },
    ]);

    expect(action?.kind).toBe("keep");
  });

  test("a stack with no claim is removed only when every folder is gone", () => {
    const gone = decideSweep([
      {
        ...base,
        slot: 3,
        stackExists: true,
        stackFoldersExist: [false, false],
      },
    ]);
    const partly = decideSweep([
      { ...base, slot: 3, stackExists: true, stackFoldersExist: [false, true] },
    ]);

    expect(gone[0]?.kind).toBe("remove");
    expect(partly[0]?.kind).toBe("keep");
  });

  test("slots with nothing behind them are not listed", () => {
    expect(decideSweep([{ ...base, slot: 4 }])).toEqual([]);
  });
});

describe("plain-language status lint", () => {
  test("accepts a sentence a product person can read", () => {
    expect(plainProblems("Bringing impressions into the reports")).toEqual([]);
  });

  test("refuses issue ids, branch names, paths, tables, code and stack traces", () => {
    expect(plainProblems("ENG-105: building the reports")).not.toEqual([]);
    expect(plainProblems("on factory/demo-1 now")).not.toEqual([]);
    expect(plainProblems("editing apps/api/src/index.ts")).not.toEqual([]);
    expect(plainProblems("filling the audit_log table")).not.toEqual([]);
    expect(plainProblems("running `bun test`")).not.toEqual([]);
    expect(plainProblems("TypeError: boom at run (/x/y.ts:3:4)")).not.toEqual(
      []
    );
    expect(plainProblems("")).toEqual(["it is empty"]);
  });
});

describe("doctor checks", () => {
  test("the Node requirement is the highest engines minimum read", () => {
    expect(requiredNode([">=24.0.0", ">=22.23.4"])).toBe("24.0.0");
    expect(requiredNode([">=22.23.4"])).toBe("22.23.4");
    expect(requiredNode([])).toBeUndefined();
  });

  test("a host Node older than the requirement fails with the version to install", () => {
    const check = nodeCheck("22.23.1", "24.0.0", [
      "apps/docs engines >=24.0.0",
    ]);

    expect(check.ok).toBe(false);
    expect(check.fix).toContain("24.0.0");
    expect(nodeCheck("24.1.0", "24.0.0", []).ok).toBe(true);
    expect(compareVersions([22, 23, 4], [22, 23, 1])).toBe(1);
  });

  test("bun must match the repo's pin exactly", () => {
    expect(bunCheck("1.4.4", "1.4.4").ok).toBe(true);
    expect(bunCheck("1.4.2", "1.4.4").ok).toBe(false);
  });

  test("free disk is read from df and compared with the minimum", () => {
    expect(
      freeBytesFromDf(
        "Filesystem 1K-blocks Used Available\n/dev/x 100 50 3514368 1% /"
      )
    ).toBe(3514368 * 1024);
    expect(freeDiskCheck(3 * 1024 ** 3).ok).toBe(false);
    expect(freeDiskCheck(20 * 1024 ** 3).ok).toBe(true);
  });
});

describe("compose policy rules", () => {
  test("a service needs a memory limit, rotated logs and start_interval", () => {
    const problems = configProblems({
      services: {
        good: {
          deploy: { resources: { limits: { memory: "64M" } } },
          logging: { options: { "max-size": "10m", "max-file": "3" } },
          healthcheck: { test: ["CMD", "true"], start_interval: "2s" },
        },
        bad: { healthcheck: { test: ["CMD", "true"] } },
      },
    });

    expect(problems).toEqual([
      "bad: no memory limit (deploy.resources.limits.memory)",
      "bad: logs not rotated (logging: *default-logging, max-size and max-file)",
      "bad: healthcheck without start_interval (it would probe as often while settled as while starting)",
    ]);
  });
});

describe("preview routes", () => {
  test("each slot routes its host to its own UI port on the host", () => {
    const conf = routesConf([
      { slot: 2, host: "s2.preview.localhost", uiPort: 7402 },
    ]);

    expect(conf).toContain("server_name s2.preview.localhost;");
    expect(conf).toContain("proxy_pass http://host.docker.internal:7402;");
    expect(conf).toContain("location = /healthz");
  });
});

describe("arguments", () => {
  test("flags are parsed and unknown ones are errors", () => {
    const parsed = parseArgs(
      ["-v", "--issue", "demo-1", "a", "b"],
      ["--issue"],
      ["-v"]
    );

    expect(isParseError(parsed)).toBe(false);
    expect(isParseError(parseArgs(["--nope"], [], []))).toBe(true);
    expect(isParseError(parseArgs(["--issue"], ["--issue"], []))).toBe(true);
  });
});

describe("slot compose settings", () => {
  test("the slot env file binds its ports and points the API at its own UI", () => {
    const text = slotEnvFileText(2);

    expect(text).toContain("UI_HOST_PORT=7402");
    expect(text).toContain("API_HOST_PORT=7502");
    expect(text).toContain("API_DEV_FRONTEND_URL=http://127.0.0.1:7402");
  });

  test("the slot project is its own, with the dev stack files", () => {
    const args = slotComposeArgs(2);

    expect(args.slice(0, 2)).toEqual(["-p", "boringstack-s2"]);
    expect(args).toContain("docker-compose.factory.yml");
    expect(args.at(-1)).toBe("dev");
  });
});
