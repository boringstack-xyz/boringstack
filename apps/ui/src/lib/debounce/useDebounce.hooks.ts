import { useEffect, useState } from "react";

import { SEARCH_DEBOUNCE_MS } from "./useDebounce.constants";

/**
 * The value as it stood once it stopped changing for `delayMs`. Type into
 * a search box and the box updates at once; the query behind it waits.
 */
export function useDebounce<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
