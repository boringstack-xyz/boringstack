import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAppPageHeader } from "./AppPageHeader.hooks";
import AppPageHeaderProvider from "./AppPageHeaderProvider/AppPageHeaderProvider";

describe("useAppPageHeader", () => {
  it("returns null before a page registers a header", () => {
    const { result } = renderHook(() => useAppPageHeader(), {
      wrapper: AppPageHeaderProvider
    });

    expect(result.current).toBeNull();
  });
});
