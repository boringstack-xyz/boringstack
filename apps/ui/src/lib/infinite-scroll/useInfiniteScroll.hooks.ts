import { useCallback, useEffect, useRef } from "react";

export interface IInfiniteScrollOptions {
  /** More pages exist on the server. */
  readonly hasMore: boolean;
  /** A page is already on its way; the sentinel waits for it. */
  readonly isFetching: boolean;
  readonly onLoadMore: () => void;
  /** How far ahead of the sentinel to start loading; a viewport by default. */
  readonly rootMargin?: string;
}

/*
 * Infinite scroll on a sentinel element: hand the returned ref to an empty
 * element after the last item, and the next page loads as it comes into
 * view. Browsers without IntersectionObserver (and jsdom) do nothing.
 */
export function useInfiniteScroll(
  options: IInfiniteScrollOptions
): (node: Element | null) => void {
  const { hasMore, isFetching, onLoadMore, rootMargin = "100%" } = options;
  const nodeRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const latest = useRef({ hasMore, isFetching, onLoadMore });

  latest.current = { hasMore, isFetching, onLoadMore };

  const observe = useCallback(
    (node: Element | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      nodeRef.current = node;

      if (node === null || typeof IntersectionObserver === "undefined") {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const state = latest.current;

          if (
            entries.some((entry) => entry.isIntersecting) &&
            state.hasMore &&
            !state.isFetching
          ) {
            state.onLoadMore();
          }
        },
        { rootMargin }
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin]
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
    },
    []
  );

  return observe;
}
