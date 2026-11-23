import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAppShellPageHeader } from "./AppShellPageHeader.hooks";

describe("useAppShellPageHeader", () => {
  it("adds the caller's classes to the header block", () => {
    const { result } = renderHook(() =>
      useAppShellPageHeader({ title: "Projects", className: "mt-1" })
    );

    expect(result.current.className).toContain("min-w-0");
    expect(result.current.className).toContain("mt-1");
    expect(result.current.titleClassName).toBeTruthy();
  });
});
