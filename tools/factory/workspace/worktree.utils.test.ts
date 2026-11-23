import { describe, expect, test } from "bun:test";

import {
  describeWork,
  isSafeToDiscard,
  parseCount,
  uncommittedCount,
} from "./worktree.utils";

describe("work safety", () => {
  test("counts changed and untracked files from porcelain status", () => {
    expect(uncommittedCount("")).toBe(0);
    expect(uncommittedCount(" M a.ts\n?? b.ts\n")).toBe(2);
  });

  test("parses rev-list counts and refuses anything unreadable", () => {
    expect(parseCount("3\n")).toBe(3);
    expect(parseCount("")).toBeUndefined();
    expect(parseCount("fatal: nope")).toBeUndefined();
  });

  test("only a clean, answered checkout is safe to discard", () => {
    expect(
      isSafeToDiscard({ uncommitted: 0, unpushed: 0, unknown: false })
    ).toBe(true);
    expect(
      isSafeToDiscard({ uncommitted: 1, unpushed: 0, unknown: false })
    ).toBe(false);
    expect(
      isSafeToDiscard({ uncommitted: 0, unpushed: 2, unknown: false })
    ).toBe(false);
    expect(
      isSafeToDiscard({ uncommitted: 0, unpushed: 0, unknown: true })
    ).toBe(false);
  });

  test("says in plain words what would be lost", () => {
    expect(describeWork({ uncommitted: 2, unpushed: 1, unknown: false })).toBe(
      "2 changed file(s) not committed; 1 commit(s) not pushed"
    );
    expect(describeWork({ uncommitted: 0, unpushed: 0, unknown: false })).toBe(
      "nothing unsaved"
    );
  });
});
