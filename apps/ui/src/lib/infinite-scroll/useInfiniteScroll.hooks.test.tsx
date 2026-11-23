import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { intersectionObservers } from "../../../tests/setup";
import { useInfiniteScroll } from "./useInfiniteScroll.hooks";

describe("useInfiniteScroll", () => {
  it("loads the next page when the sentinel comes into view and more exists", () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ hasMore: true, isFetching: false, onLoadMore })
    );
    const sentinel = document.createElement("div");

    result.current(sentinel);

    const observer = intersectionObservers.at(-1);

    expect(observer?.targets.has(sentinel)).toBe(true);

    observer?.trigger(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    observer?.trigger(false);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("stays quiet while a page is loading or nothing is left", () => {
    const onLoadMore = vi.fn();
    const { result, rerender } = renderHook(
      (props: { hasMore: boolean; isFetching: boolean }) =>
        useInfiniteScroll({ ...props, onLoadMore }),
      { initialProps: { hasMore: true, isFetching: true } }
    );

    result.current(document.createElement("div"));
    intersectionObservers.at(-1)?.trigger(true);
    expect(onLoadMore).not.toHaveBeenCalled();

    rerender({ hasMore: false, isFetching: false });
    intersectionObservers.at(-1)?.trigger(true);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("disconnects the observer when the sentinel goes away", () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        isFetching: false,
        onLoadMore: vi.fn()
      })
    );

    result.current(document.createElement("div"));

    const observer = intersectionObservers.at(-1);

    result.current(null);
    expect(observer?.targets.size).toBe(0);
  });
});
