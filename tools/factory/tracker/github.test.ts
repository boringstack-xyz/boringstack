import { describe, expect, test } from "bun:test";

import { createGitHubTracker } from "./github";
import { createPr, findOpenPr, updatePr } from "./github.pr";
import {
  failResult,
  fakeRunner,
  okResult,
  rejectionOf,
} from "./tracker.fixtures";
import { HANDOVER_MARKER, withMarker } from "./tracker.utils";

const REPO = "boringstack-xyz/boringstack";

const issueJson = (comments: { id: string; body: string }[]): string =>
  JSON.stringify({
    number: 12,
    title: "Week start setting",
    body: "## Acceptance criteria\n- one",
    url: "https://github.com/boringstack-xyz/boringstack/issues/12",
    labels: [{ name: "feature" }],
    comments,
  });

describe("GitHub tracker", () => {
  test("reads the issue through gh, with its labels and comments", async () => {
    const fake = fakeRunner(() =>
      okResult(issueJson([{ id: "IC_1", body: "hi" }]))
    );
    const issue = await createGitHubTracker(REPO, fake.run).issue("12");

    expect(fake.calls[0]?.args.slice(0, 4)).toEqual([
      "issue",
      "view",
      "12",
      "--repo",
    ]);
    expect(issue).toEqual({
      id: "12",
      title: "Week start setting",
      body: "## Acceptance criteria\n- one",
      labels: ["feature"],
      url: "https://github.com/boringstack-xyz/boringstack/issues/12",
      comments: [{ id: "IC_1", body: "hi" }],
    });
  });

  test("adds the card when no comment carries the marker", async () => {
    const fake = fakeRunner((_command, args) =>
      args[0] === "issue" && args[1] === "view"
        ? okResult(issueJson([]))
        : undefined
    );
    const body = withMarker("### Ready to review", HANDOVER_MARKER);
    const result = await createGitHubTracker(REPO, fake.run).upsertComment(
      "12",
      HANDOVER_MARKER,
      body
    );

    expect(result).toBe("created");
    const add = fake.calls.find((call) => call.args[1] === "comment");

    expect(add?.args).toEqual([
      "issue",
      "comment",
      "12",
      "--repo",
      REPO,
      "--body",
      body,
    ]);
  });

  test("edits the existing card by its node id, never adds a second", async () => {
    const existing = withMarker("### Ready to review (v1)", HANDOVER_MARKER);
    const fake = fakeRunner((_command, args) =>
      args[0] === "issue" && args[1] === "view"
        ? okResult(issueJson([{ id: "IC_card", body: existing }]))
        : undefined
    );
    const body = withMarker("### Ready to review (v2)", HANDOVER_MARKER);
    const result = await createGitHubTracker(REPO, fake.run).upsertComment(
      "12",
      HANDOVER_MARKER,
      body
    );

    expect(result).toBe("updated");
    expect(fake.calls.some((call) => call.args[1] === "comment")).toBe(false);
    const edit = fake.calls.find((call) => call.args[0] === "api");

    expect(edit?.args).toContain("id=IC_card");
    expect(edit?.args).toContain(`body=${body}`);
  });

  test("moves the issue to review by its labels", async () => {
    const fake = fakeRunner();

    await createGitHubTracker(REPO, fake.run).setState("12", "review");

    expect(fake.calls.map((call) => call.args.slice(0, 2))).toEqual([
      ["label", "create"],
      ["issue", "edit"],
    ]);
    expect(fake.calls[1]?.args).toEqual([
      "issue",
      "edit",
      "12",
      "--repo",
      REPO,
      "--add-label",
      "factory:review",
      "--remove-label",
      "factory:in-progress",
    ]);
  });

  test("a gh failure is an error with gh's words", async () => {
    const fake = fakeRunner(() => failResult("could not find issue 999"));

    const message = await rejectionOf(
      createGitHubTracker(REPO, fake.run).issue("999")
    );

    expect(message).toContain("could not find issue 999");
  });
});

describe("GitHub pull requests", () => {
  test("finds the open pull request of a branch, or none", () => {
    const none = fakeRunner(() => okResult("[]"));
    const one = fakeRunner(() =>
      okResult(
        JSON.stringify([
          { number: 9, url: "https://github.com/o/r/pull/9", isDraft: true },
        ])
      )
    );

    expect(findOpenPr(none.run, REPO, "factory/12")).toBeUndefined();
    expect(findOpenPr(one.run, REPO, "factory/12")?.number).toBe(9);
  });

  test("creates the pull request with its body on stdin, and returns its URL", () => {
    const fake = fakeRunner(() =>
      okResult("Creating pull request\nhttps://github.com/o/r/pull/10\n")
    );
    const url = createPr(fake.run, {
      repo: REPO,
      base: "main",
      head: "factory/12",
      title: "feat: x",
      body: "**Risk: ui** (copy)",
      draft: true,
      cwd: "/tmp/checkout",
    });

    expect(url).toBe("https://github.com/o/r/pull/10");
    expect(fake.calls[0]?.args).toContain("--draft");
    expect(fake.calls[0]?.args).toContain("--body-file");
    expect(fake.calls[0]?.input).toBe("**Risk: ui** (copy)");
  });

  test("updating a draft that is now complete marks it ready", () => {
    const fake = fakeRunner();

    updatePr(fake.run, {
      repo: REPO,
      pr: { number: 9, url: "https://github.com/o/r/pull/9", isDraft: true },
      title: "feat: x",
      body: "body",
      draft: false,
      cwd: "/tmp/checkout",
    });

    expect(fake.calls.map((call) => call.args.slice(0, 2))).toEqual([
      ["pr", "edit"],
      ["pr", "ready"],
    ]);
    expect(fake.calls[1]?.args).not.toContain("--undo");
  });
});
