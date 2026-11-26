import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createContext, type IFactoryContext } from "../context";
import { recordFile } from "../record/verification";
import { writeJson, writeText } from "../state";
import { handoverWith } from "./handover";
import { issueWith } from "./issue";
import { prWith } from "./pr";
import {
  completeRecord,
  depsOf,
  failResult,
  fakeRunner,
  type IRecordedCall,
  okResult,
} from "./tracker.fixtures";
import type { IProcessResult } from "./process";

/*
 * The three tracker commands end to end against a throwaway git repository
 * whose origin is a GitHub URL. gh is a fake runner: nothing reaches GitHub.
 */
const git = (cwd: string, args: string[]): string => {
  const result = spawnSync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.invalid",
      /* A throwaway repo: never ask the developer's signing agent. */
      "-c",
      "commit.gpgsign=false",
      "-c",
      "tag.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
};

const BRANCH = "factory/12";
let root = "";
let sha = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "factory-tracker-"));
  git(root, ["init", "-q", "-b", "main"]);
  git(root, [
    "remote",
    "add",
    "origin",
    "git@github.com:boringstack-xyz/boringstack.git",
  ]);
  git(root, ["commit", "-q", "--allow-empty", "-m", "feat: base"]);
  git(root, ["checkout", "-q", "-b", BRANCH]);
  git(root, ["commit", "-q", "--allow-empty", "-m", "fix: billing copy"]);
  sha = git(root, ["rev-parse", "HEAD"]);
  mkdirSync(join(root, "scripts", "ci"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/* The shared directory is the throwaway one, never the machine's. */
const contextOf = (): IFactoryContext => ({
  ...createContext(false, root),
  sharedDir: join(root, ".agent-state", "shared"),
});

const pushBranch = (): void => {
  git(root, ["update-ref", `refs/remotes/origin/${BRANCH}`, BRANCH]);
};

const unpushBranch = (): void => {
  git(root, ["update-ref", "-d", `refs/remotes/origin/${BRANCH}`]);
};

const writeRecord = (text: string): void => {
  writeText(recordFile(contextOf(), BRANCH), text);
};

const issueJson = (comments: { id: string; body: string }[]): string =>
  JSON.stringify({
    number: 12,
    title: "Billing button copy",
    body: "## Acceptance criteria\n- the button says Pay now",
    url: "https://github.com/boringstack-xyz/boringstack/issues/12",
    labels: [],
    comments,
  });

const writes = (calls: readonly IRecordedCall[]): IRecordedCall[] =>
  calls.filter(
    (call) =>
      call.command === "gh" &&
      (call.args.includes("comment") ||
        call.args.includes("edit") ||
        call.args.includes("create") ||
        call.args[0] === "api" ||
        call.args.includes("ready")) &&
      !call.args.includes("--dry-run")
  );

const ghIssueView =
  (
    comments: { id: string; body: string }[] = []
  ): ((
    command: string,
    args: readonly string[]
  ) => IProcessResult | undefined) =>
  (command, args) =>
    command === "gh" && args[0] === "issue" && args[1] === "view"
      ? okResult(issueJson(comments))
      : undefined;

describe("factory handover", () => {
  test("refuses (blocked) while the branch is not on GitHub", async () => {
    writeRecord(completeRecord({ branch: BRANCH, commit: sha }));
    const fake = fakeRunner(ghIssueView());
    const outcome = await handoverWith(depsOf(fake))([BRANCH], contextOf());

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("not on GitHub yet");
    expect(fake.calls).toHaveLength(0);
  });

  test("refuses (blocked) while the record is incomplete", async () => {
    pushBranch();
    rmSync(recordFile(contextOf(), BRANCH), { force: true });
    const outcome = await handoverWith(depsOf(fakeRunner(ghIssueView())))(
      [BRANCH],
      contextOf()
    );

    expect(outcome.code).toBe(2);
    expect(outcome.summary).toContain("there is no verification record");
  });

  test("adds the card with the preview and the review depth, then moves the issue to review", async () => {
    pushBranch();
    writeRecord(completeRecord({ branch: BRANCH, commit: sha }));
    writeJson(join(contextOf().sharedDir, "slots", "s3.json"), {
      workspace: root,
    });
    writeJson(join(contextOf().sharedDir, "preview", "s3.json"), {
      url: "http://127.0.0.1:7403",
    });
    const fake = fakeRunner(ghIssueView());
    const outcome = await handoverWith(depsOf(fake))([BRANCH], contextOf());

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toBe(
      "hand-over card created on issue 12; it is in review"
    );
    const add = fake.calls.find((call) => call.args[1] === "comment");

    expect(add?.input).toBeUndefined();
    expect(add?.args.join(" ")).toContain("<!-- factory:handover -->");
    expect(add?.args.join(" ")).toContain("http://127.0.0.1:7403");
    expect(
      fake.calls.some((call) => call.args.includes("factory:review"))
    ).toBe(true);
  });

  test("edits the card already on the issue instead of adding one", async () => {
    pushBranch();
    writeRecord(completeRecord({ branch: BRANCH, commit: sha }));
    const fake = fakeRunner((command, args) =>
      ghIssueView([{ id: "IC_card", body: "<!-- factory:handover -->\nold" }])(
        command,
        args
      )
    );
    const outcome = await handoverWith(depsOf(fake))([BRANCH], contextOf());

    expect(outcome.summary).toContain("updated");
    expect(fake.calls.some((call) => call.args[1] === "comment")).toBe(false);
    expect(writes(fake.calls).length).toBeGreaterThan(0);
  });

  test("a dry run posts nothing, and still shows the card when the issue cannot be read", async () => {
    pushBranch();
    writeRecord(completeRecord({ branch: BRANCH, commit: sha }));
    const fake = fakeRunner((command, args) =>
      command === "gh" && args[1] === "view"
        ? failResult("could not find issue 12")
        : undefined
    );
    const outcome = await handoverWith(depsOf(fake))(
      [BRANCH, "--dry-run"],
      contextOf()
    );

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toContain("[dry run] nothing posted");
    expect(outcome.summary).toContain("could not read issue 12");
    expect(outcome.summary).toContain("### Ready to review: fix: billing copy");
    expect(writes(fake.calls)).toHaveLength(0);
  });
});

describe("factory pr", () => {
  test("refuses (blocked) while the branch is not on GitHub", async () => {
    unpushBranch();
    const outcome = await prWith(depsOf(fakeRunner(ghIssueView())))(
      [BRANCH],
      contextOf()
    );

    expect(outcome.code).toBe(2);
  });

  test("opens a draft with Risk first and Closes #12 when the record is incomplete", async () => {
    pushBranch();
    rmSync(recordFile(contextOf(), BRANCH), { force: true });
    const fake = fakeRunner((command, args) => {
      if (command === "gh" && args[0] === "pr" && args[1] === "list") {
        return okResult("[]");
      }

      if (command === "gh" && args[1] === "create") {
        return okResult(
          "https://github.com/boringstack-xyz/boringstack/pull/30\n"
        );
      }

      return ghIssueView()(command, args);
    });
    const outcome = await prWith(depsOf(fake))([BRANCH], contextOf());
    const create = fake.calls.find((call) => call.args[1] === "create");

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toBe(
      "opened pull request https://github.com/boringstack-xyz/boringstack/pull/30 as a draft"
    );
    expect(create?.args).toContain("--draft");
    expect(create?.args).toContain("feat: Billing button copy");
    expect(create?.input?.split("\n")[0]).toBe("**Risk: not set**");
    expect(create?.input).toContain("Closes #12");
  });

  test("updates the existing pull request, and marks it ready once the record is complete", async () => {
    pushBranch();
    writeRecord(completeRecord({ branch: BRANCH, commit: sha }));
    const fake = fakeRunner((command, args) => {
      if (command === "gh" && args[0] === "pr" && args[1] === "list") {
        return okResult(
          JSON.stringify([
            {
              number: 30,
              url: "https://github.com/o/r/pull/30",
              isDraft: true,
            },
          ])
        );
      }

      return ghIssueView()(command, args);
    });
    const outcome = await prWith(depsOf(fake))([BRANCH], contextOf());

    expect(outcome.summary).toBe(
      "updated pull request https://github.com/o/r/pull/30"
    );
    expect(fake.calls.some((call) => call.args[1] === "create")).toBe(false);
    expect(
      fake.calls.find((call) => call.args[1] === "ready")?.args
    ).not.toContain("--undo");
    expect(fake.calls.find((call) => call.args[1] === "edit")?.input).toContain(
      "**Risk: low** (button copy on the billing page)"
    );
  });

  test("a dry run opens nothing and prints the title, the draft state and the body", async () => {
    pushBranch();
    rmSync(recordFile(contextOf(), BRANCH), { force: true });
    const fake = fakeRunner((command, args) =>
      command === "gh" && args[1] === "list"
        ? okResult("[]")
        : ghIssueView()(command, args)
    );
    const outcome = await prWith(depsOf(fake))(
      [BRANCH, "--dry-run"],
      contextOf()
    );

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toContain("It would open a pull request into main");
    expect(outcome.summary).toContain("Title: feat: Billing button copy");
    expect(outcome.summary).toContain("Draft: yes");
    expect(fake.calls.some((call) => call.args[1] === "create")).toBe(false);
  });
});

describe("factory issue", () => {
  test("prints the title, the criteria and the labels", async () => {
    const outcome = await issueWith(depsOf(fakeRunner(ghIssueView())))(
      ["12"],
      contextOf()
    );

    expect(outcome.code).toBe(0);
    expect(outcome.summary).toContain("12: Billing button copy");
    expect(outcome.summary).toContain("- the button says Pay now");
    expect(outcome.summary).toContain("Labels: none");
  });
});
