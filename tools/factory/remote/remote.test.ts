import { describe, expect, test } from "bun:test";

import type { IRunResult, ProcessRunner } from "../fleet/process";
import { contextAt, tempDir } from "../fleet/fleet.test-helpers";
import { EXIT } from "../result";
import {
  parseGhNames,
  remoteCommand,
  renderRemote,
  type IRemoteDeps,
} from "./remote";

const reply = (stdout = "", status = 0, stderr = ""): IRunResult => ({
  status,
  stdout,
  stderr,
});

/** A gh that answers `secret list` and `variable list` from fixtures and records every call. */
const ghWith = (secrets: string, variables: string) => {
  const calls: string[] = [];

  const run: ProcessRunner = (program, args) => {
    calls.push([program, ...args].join(" "));

    if (args[0] === "secret" && args[1] === "list") {
      return reply(secrets);
    }

    if (args[0] === "variable" && args[1] === "list") {
      return reply(variables);
    }

    return reply("", 1, "unexpected call");
  };

  return { calls, run };
};

const depsWith = (run: ProcessRunner, blueprint: boolean): IRemoteDeps => ({
  run,
  exists: () => blueprint,
});

const rootContext = () => {
  const root = tempDir("remote");

  return contextAt(root, root);
};

describe("parseGhNames", () => {
  test("reads the name column of secrets and the name and value of variables", () => {
    expect([
      ...parseGhNames("CLAUDE_CODE_OAUTH_TOKEN\t2026-11-01\n", "secret"),
    ]).toEqual([["CLAUDE_CODE_OAUTH_TOKEN", undefined]]);
    expect([
      ...parseGhNames("AGENTS_ENABLED\t1\t2026-11-01\n", "variable"),
    ]).toEqual([["AGENTS_ENABLED", "1"]]);
  });

  test("skips blank and malformed rows", () => {
    expect(parseGhNames("\nnot a name\tx\n", "secret").size).toBe(0);
  });
});

describe("remoteCommand", () => {
  test("reports missing lane settings with the exact command to set each one", () => {
    const gh = ghWith("", "");
    const outcome = remoteCommand(rootContext(), depsWith(gh.run, true));

    expect(outcome.code).toBe(EXIT.ok);
    expect(outcome.summary).toContain("CLAUDE_CODE_OAUTH_TOKEN: missing");
    expect(outcome.summary).toContain("gh secret set CLAUDE_CODE_OAUTH_TOKEN");
    expect(outcome.summary).toContain("AGENTS_ENABLED: missing");
    expect(outcome.summary).toContain(
      "gh variable set AGENTS_ENABLED --body 1"
    );
    expect(outcome.summary).toContain("Lanes stay off");
    expect(gh.calls).toEqual(["gh secret list", "gh variable list"]);
  });

  test("says the lanes are configured when both are present, and shows only the safe values", () => {
    const gh = ghWith(
      "CLAUDE_CODE_OAUTH_TOKEN\t2026-11-01\n",
      "AGENTS_ENABLED\t1\t2026-11-01\nSOMETHING_ELSE\tsecret-looking-value\t2026-11-01\n"
    );
    const outcome = remoteCommand(rootContext(), depsWith(gh.run, true));

    expect(outcome.summary).toContain("CLAUDE_CODE_OAUTH_TOKEN: set");
    expect(outcome.summary).toContain("AGENTS_ENABLED: set to 1");
    expect(outcome.summary).toContain("The lanes are configured");
    expect(outcome.summary).not.toContain("secret-looking-value");
  });

  test("reports tier c from the checkout, and blocks when gh cannot be read", () => {
    const noBlueprint = renderRemote({
      tierA: { summary: "a" },
      tierB: { items: [] },
      tierC: { blueprint: false },
    });

    expect(noBlueprint).toContain("infra/agent-host is missing");

    const failing: ProcessRunner = () => reply("", 4, "gh auth login");
    const blocked = remoteCommand(rootContext(), depsWith(failing, true));

    expect(blocked.code).toBe(EXIT.blocked);
    expect(blocked.summary).toContain("gh cannot list secrets");

    const absent: ProcessRunner = () => reply("", 127, "spawn gh ENOENT");
    const notInstalled = remoteCommand(rootContext(), depsWith(absent, true));

    expect(notInstalled.code).toBe(EXIT.blocked);
    expect(notInstalled.summary).toContain("gh is not installed");
  });

  test("is read-only: it never sets a secret or variable", () => {
    const gh = ghWith("", "");

    remoteCommand(rootContext(), depsWith(gh.run, true));

    expect(gh.calls.every((call) => !/ (set|delete) /u.test(call))).toBe(true);
  });
});
