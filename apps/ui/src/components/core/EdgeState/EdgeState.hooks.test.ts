import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EDGE_STATE_TEST_ID } from "./EdgeState.constants";
import { useEdgeState } from "./EdgeState.hooks";
import type { IEdgeStateProps } from "./EdgeState.types";

function viewOf(props: IEdgeStateProps) {
  return renderHook(() => useEdgeState(props)).result.current;
}

describe("useEdgeState", () => {
  it("announces a broken state as an alert and work under way as a busy status", () => {
    expect(viewOf({ kind: "error", title: "x" }).role).toBe("alert");
    expect(viewOf({ kind: "loading", title: "x" })).toMatchObject({
      role: "status",
      isBusy: true
    });
  });

  it("uses the default test id and a roomier card unless it is compact", () => {
    const card = viewOf({ kind: "empty", title: "x" });
    const compact = viewOf({ kind: "empty", title: "x", size: "compact" });

    expect(card.testId).toBe(EDGE_STATE_TEST_ID);
    expect(card.sectionClass).toContain("rounded-lg");
    expect(compact.sectionClass).not.toContain("rounded-lg");
  });

  it("reports whether there are actions to render", () => {
    expect(viewOf({ kind: "empty", title: "x" }).hasActions).toBe(false);
    expect(
      viewOf({
        kind: "empty",
        title: "x",
        action: { label: "Go", onClick: () => undefined }
      }).hasActions
    ).toBe(true);
  });
});
