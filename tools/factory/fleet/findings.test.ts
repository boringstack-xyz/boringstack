import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contextAt, fakeRunner, tempDir } from "./fleet.test-helpers";
import { findingsRun, ledgerPathOf, MAX_NEW_ISSUES } from "./findings";
import {
  githubIssueFiler,
  issueBodyOf,
  issueTitleOf,
  type IIssueFiler,
} from "./findings.file";
import { readJson } from "../state";
import { type IFinding, parseLedger } from "./findings.utils";

const psLine = (service: string): string =>
  JSON.stringify({
    Names: `boringstack-s1-${service}-1`,
    State: "running",
    Status: "Up (healthy)",
    Ports: "",
    Labels: `com.docker.compose.project=boringstack-s1,com.docker.compose.service=${service}`,
  });

const logs = [
  '2026-11-23T10:00:01.000Z {"level":"ERROR","msg":"unexpected failure for ada@example.com in 12 ms"}',
  '2026-11-23T10:00:02.000Z {"level":"ERROR","msg":"unexpected failure for bob@example.com in 30 ms"}',
  '2026-11-23T10:00:03.000Z {"level":"ERROR","msg":"stack refused on purpose"}',
].join("\n");

const runner = () =>
  fakeRunner((_program, args) => {
    if (args[0] === "ps") {
      return { status: 0, stdout: psLine("api"), stderr: "" };
    }

    if (args[0] === "logs") {
      return { status: 0, stdout: logs, stderr: "" };
    }

    return undefined;
  });

/** A filer that records what it was asked to file and never reaches a tracker. */
const recordingFiler = (): { filer: IIssueFiler; filed: string[] } => {
  const filed: string[] = [];

  return {
    filed,
    filer: {
      file: (finding: IFinding) => {
        filed.push(finding.signature);

        return Promise.resolve({
          url: `https://github.com/o/r/issues/${String(filed.length)}`,
        });
      },
    },
  };
};

const now = Date.parse("2026-11-23T11:00:00Z");

const writeExpected = (root: string, rules: unknown[]): void => {
  mkdirSync(join(root, "tools", "factory"), { recursive: true });
  writeFileSync(
    join(root, "tools", "factory", "expected-log-findings.json"),
    JSON.stringify({ version: 1, description: "test", rules })
  );
};

describe("factory findings", () => {
  test("the ledger groups errors and mutes the expected ones, without filing", async () => {
    const root = tempDir("findings-root");
    const shared = tempDir("findings-shared");
    const context = contextAt(root, shared);
    const { filer, filed } = recordingFiler();

    writeExpected(root, [
      { service: "api", match: "^stack refused", reason: "on purpose" },
    ]);

    const outcome = await findingsRun([], context, {
      run: runner().run,
      filer,
      now: () => now,
    });
    const ledger = parseLedger(readJson(ledgerPathOf(shared)));

    expect(outcome.code).toBe(0);
    expect(filed).toEqual([]);
    expect(
      ledger.findings
        .map((finding) => [finding.signature, finding.count, finding.muted])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    ).toEqual([
      ["stack refused on purpose", 1, true],
      ["unexpected failure for <email> in <n> ms", 2, false],
    ]);
    // The example never carries an address
    expect(JSON.stringify(ledger)).not.toContain("example.com");
  });

  test("--file files each new unmuted finding once, and not again on the next run", async () => {
    const root = tempDir("findings-file");
    const shared = tempDir("findings-file-shared");
    const context = contextAt(root, shared);
    const { filer, filed } = recordingFiler();

    writeExpected(root, [
      { service: "api", match: "^stack refused", reason: "on purpose" },
    ]);

    const first = await findingsRun(["--file"], context, {
      run: runner().run,
      filer,
      now: () => now,
    });
    const second = await findingsRun(["--file"], context, {
      run: runner().run,
      filer,
      now: () => now,
    });

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(filed).toEqual(["unexpected failure for <email> in <n> ms"]);
    expect(MAX_NEW_ISSUES).toBeGreaterThan(0);
  });

  test("a filing failure stops the run and says why", async () => {
    const root = tempDir("findings-fail");
    const shared = tempDir("findings-fail-shared");
    const failing: IIssueFiler = {
      file: () => Promise.reject(new Error("gh is not logged in")),
    };

    writeExpected(root, []);

    const outcome = await findingsRun(["--file"], contextAt(root, shared), {
      run: runner().run,
      filer: failing,
      now: () => now,
    });

    expect(outcome.code).toBe(1);
    expect(outcome.summary).toContain("Filing stopped: gh is not logged in");
  });

  test("an expected-findings file that does not read blocks the run", async () => {
    const root = tempDir("findings-bad");
    const shared = tempDir("findings-bad-shared");

    writeExpected(root, [{ service: "api", match: "(", reason: "broken" }]);

    const outcome = await findingsRun([], contextAt(root, shared), {
      run: runner().run,
      filer: recordingFiler().filer,
      now: () => now,
    });

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("not usable");
  });
});

describe("gh issue filer", () => {
  const finding: IFinding = {
    id: "abc123",
    service: "api",
    event: null,
    signature: "boom <n>",
    count: 3,
    firstSeen: "2026-11-23T10:00:00Z",
    lastSeen: "2026-11-23T10:05:00Z",
    example: "boom 1",
    muted: false,
    filed: null,
  };

  test("creates an issue with gh, the body on stdin, and returns its address", async () => {
    const fake = fakeRunner((program, args) =>
      program === "gh" && args[0] === "issue"
        ? {
            status: 0,
            stdout: "https://github.com/o/r/issues/12\n",
            stderr: "",
          }
        : undefined
    );
    const filer = githubIssueFiler(fake.run, "/work/s1");

    expect(await filer.file(finding)).toEqual({
      url: "https://github.com/o/r/issues/12",
    });
    expect(fake.calls).toEqual([
      `gh issue create --title ${issueTitleOf(finding)} --body-file -`,
    ]);
    expect(issueBodyOf(finding)).toContain("Finding `abc123`");
  });

  test("a gh failure is a plain rejection with its reason", async () => {
    const fake = fakeRunner(() => ({
      status: 1,
      stdout: "",
      stderr: "not logged in",
    }));

    const filing = githubIssueFiler(fake.run, "/work").file(finding);

    const reason = await filing.then(
      () => "resolved",
      (error: unknown) => (error instanceof Error ? error.message : "")
    );

    expect(reason).toBe("gh issue create failed (exit 1): not logged in");
  });
});
