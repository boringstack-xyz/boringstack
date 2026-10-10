import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useQueryErrorState } from "./QueryErrorState.hooks";

describe("useQueryErrorState", () => {
  it("calls onRetry when not already retrying", () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useQueryErrorState({ message: "m", retryLabel: "r", onRetry })
    );

    result.current.handleRetry();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(result.current.isRetrying).toBe(false);
  });

  it("ignores retry while a retry is in flight", () => {
    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useQueryErrorState({
        message: "m",
        retryLabel: "r",
        onRetry,
        isRetrying: true
      })
    );

    result.current.handleRetry();

    expect(onRetry).not.toHaveBeenCalled();
    expect(result.current.isRetrying).toBe(true);
  });
});
