import { describe, expect, test } from "bun:test";

import {
  HANDOVER_MARKER,
  linearStateId,
  planUpsert,
  repoSlugOf,
  withMarker,
} from "./tracker.utils";

describe("planUpsert", () => {
  test("creates the card when no comment holds the marker", () => {
    expect(planUpsert([{ id: "c1", body: "a note" }], HANDOVER_MARKER)).toEqual(
      {
        action: "create",
      }
    );
  });

  test("edits the first comment holding the marker, never adds a second", () => {
    const comments = [
      { id: "c1", body: "a note" },
      { id: "c2", body: `${HANDOVER_MARKER}\ncard v1` },
      { id: "c3", body: `${HANDOVER_MARKER}\ncard v0` },
    ];

    expect(planUpsert(comments, HANDOVER_MARKER)).toEqual({
      action: "update",
      id: "c2",
    });
  });
});

describe("withMarker", () => {
  test("puts the marker first, once", () => {
    const once = withMarker("### Ready\n\nbody", HANDOVER_MARKER);

    expect(once).toBe(`${HANDOVER_MARKER}\n### Ready\n\nbody\n`);
    expect(withMarker(once, HANDOVER_MARKER)).toBe(once);
  });
});

describe("linearStateId", () => {
  const states = [
    { id: "s-done", name: "Done", type: "completed" },
    { id: "s-review-done", name: "Reviewed", type: "completed" },
    { id: "s-review", name: "In Review", type: "started" },
  ];

  test("picks the started review state over a completed one", () => {
    expect(linearStateId(states, "review")).toBe("s-review");
  });

  test("undefined when the team has no review state", () => {
    expect(
      linearStateId(
        [{ id: "s-done", name: "Done", type: "completed" }],
        "review"
      )
    ).toBeUndefined();
  });

  test("matches the emoji-prefixed name some teams use", () => {
    expect(
      linearStateId(
        [{ id: "s-eyes", name: "👀 Review", type: "started" }],
        "review"
      )
    ).toBe("s-eyes");
  });
});

describe("repoSlugOf", () => {
  test("reads https and ssh GitHub remotes, with or without .git", () => {
    expect(
      repoSlugOf("https://github.com/boringstack-xyz/boringstack.git")
    ).toBe("boringstack-xyz/boringstack");
    expect(repoSlugOf("git@github.com:boringstack-xyz/boringstack.git")).toBe(
      "boringstack-xyz/boringstack"
    );
    expect(repoSlugOf("https://github.com/boringstack-xyz/boringstack")).toBe(
      "boringstack-xyz/boringstack"
    );
  });

  test("undefined for other hosts and for a missing remote", () => {
    expect(repoSlugOf("https://gitlab.com/a/b.git")).toBeUndefined();
    expect(repoSlugOf(undefined)).toBeUndefined();
  });
});
