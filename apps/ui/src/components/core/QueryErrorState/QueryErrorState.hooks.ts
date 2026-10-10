import { useCallback } from "react";

import type { IQueryErrorStateProps } from "./QueryErrorState.types";

/*
 * Retry is ignored while one is already in flight, so a double click cannot
 * queue two refetches of the same list.
 */
export function useQueryErrorState(props: IQueryErrorStateProps): {
  readonly isRetrying: boolean;
  readonly handleRetry: () => void;
} {
  const { onRetry, isRetrying = false } = props;

  const handleRetry = useCallback((): void => {
    if (!isRetrying) {
      onRetry();
    }
  }, [isRetrying, onRetry]);

  return { isRetrying, handleRetry };
}
