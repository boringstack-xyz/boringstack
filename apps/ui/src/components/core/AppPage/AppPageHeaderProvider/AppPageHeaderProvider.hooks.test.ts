import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAppPageHeaderProvider } from "./AppPageHeaderProvider.hooks";

describe("useAppPageHeaderProvider", () => {
  it("starts with an empty header", () => {
    const { result } = renderHook(() => useAppPageHeaderProvider());

    expect(result.current.contextValue.header).toBeNull();
  });
});
