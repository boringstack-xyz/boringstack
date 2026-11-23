import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSectionTitle } from "./SectionTitle.hooks";

describe("useSectionTitle", () => {
  it("is a section heading unless the level is 3", () => {
    expect(
      renderHook(() => useSectionTitle({ title: "A" })).result.current
        .isSubsection
    ).toBe(false);
    expect(
      renderHook(() => useSectionTitle({ title: "A", level: 3 })).result.current
        .isSubsection
    ).toBe(true);
  });
});
