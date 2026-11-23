import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "./useDebounce.hooks";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles on the last value only after the delay passes without changes", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 250),
      { initialProps: { value: "" } }
    );

    rerender({ value: "d" });
    rerender({ value: "dp" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("");

    rerender({ value: "dp1" });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("dp1");
  });
});
