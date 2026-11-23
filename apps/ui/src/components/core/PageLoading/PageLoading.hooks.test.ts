import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePageLoading } from "./PageLoading.hooks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe("usePageLoading", () => {
  it("falls back to the common loading label", () => {
    const { result } = renderHook(() => usePageLoading({}));

    expect(result.current.title).toBe("common.loading");
    expect(result.current.className).toContain("min-h-screen");
  });

  it("fills only the given space when not full screen", () => {
    const { result } = renderHook(() =>
      usePageLoading({ title: "Opening", fullScreen: false })
    );

    expect(result.current.title).toBe("Opening");
    expect(result.current.className).toContain("min-h-48");
  });
});
