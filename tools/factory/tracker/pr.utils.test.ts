import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

import { completeRecord } from "./tracker.fixtures";
import { conventionalTitle, prBody, urlIn } from "./pr.utils";

const CHECK_SCRIPT = `${import.meta.dir}/../../../scripts/ci/check-commit-title.sh`;

const passesCommitTitleCheck = (title: string): boolean =>
  spawnSync("bash", [CHECK_SCRIPT, title], { encoding: "utf8" }).status === 0;

describe("conventionalTitle", () => {
  test("a feature by default, a fix for a bug label, and the result passes the repo's title check", () => {
    const feature = conventionalTitle({
      issueTitle: "Week start setting",
      labels: [],
      fallback: "x",
    });
    const fix = conventionalTitle({
      issueTitle: "Billing button double-submits.",
      labels: ["bug"],
      fallback: "x",
    });

    expect(feature).toBe("feat: Week start setting");
    expect(fix).toBe("fix: Billing button double-submits");
    expect(passesCommitTitleCheck(feature)).toBe(true);
    expect(passesCommitTitleCheck(fix)).toBe(true);
  });

  test("keeps an issue title that is already conventional, and falls back to the commit subject", () => {
    expect(
      conventionalTitle({
        issueTitle: "docs(factory): explain the card",
        labels: [],
        fallback: "x",
      })
    ).toBe("docs(factory): explain the card");
    expect(
      conventionalTitle({ issueTitle: "", labels: [], fallback: "chore: tidy" })
    ).toBe("chore: tidy");
  });

  test("never longer than the commit-title limit", () => {
    const title = conventionalTitle({
      issueTitle: "word ".repeat(40),
      labels: [],
      fallback: "x",
    });

    expect(title.length).toBeLessThanOrEqual(100);
    expect(passesCommitTitleCheck(title)).toBe(true);
  });
});

describe("prBody", () => {
  test("Risk on the first line, the issue link, then the record demoted under Verification", () => {
    const body = prBody({
      risk: "ui",
      reason: "button copy",
      reference: "Closes #12",
      record: completeRecord({ branch: "factory/12", commit: "abc1234" }),
      problems: [],
    });
    const lines = body.split("\n");

    expect(lines[0]).toBe("**Risk: ui** (button copy)");
    expect(body).toContain("Closes #12");
    expect(body).toContain("## Verification");
    expect(body).toContain("## Checks run");
    expect(body).not.toContain("# Verification: factory/12");
    expect(body).not.toContain("Draft:");
  });

  test("names what keeps it a draft", () => {
    const body = prBody({
      risk: undefined,
      reason: "",
      reference: "Closes #12",
      record: "",
      problems: ['section "Risk" is missing'],
    });

    expect(body.split("\n")[0]).toBe("**Risk: not set**");
    expect(body).toContain(
      "Draft: the verification record is not complete yet:"
    );
    expect(body).toContain("There is no verification record");
  });
});

describe("urlIn", () => {
  test("the URL gh prints for a new pull request", () => {
    expect(
      urlIn("Creating pull request...\nhttps://github.com/o/r/pull/9\n")
    ).toBe("https://github.com/o/r/pull/9");
    expect(urlIn("nothing here")).toBeUndefined();
  });
});
