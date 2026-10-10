import {
  DEVTOOLS_QUERY_PARAM,
  DEVTOOLS_STORAGE_KEY,
  DISABLED_VALUES
} from "./QueryProvider.devtools.constants";
import type { IDevtoolsStorage } from "./QueryProvider.devtools.types";

export { DEVTOOLS_STORAGE_KEY } from "./QueryProvider.devtools.constants";
export type { IDevtoolsStorage } from "./QueryProvider.devtools.types";

/*
 * Decides whether the React Query devtools panel is shown. `?devtools` turns
 * it on for the session, `?devtools=0` turns it off, and the last explicit
 * choice is kept in sessionStorage so it survives in-app navigation and reloads
 * in the same tab. Storage failures (private mode, blocked storage) fall back
 * to "off" and never throw.
 */
export function resolveDevtoolsEnabled(
  search: string,
  storage: IDevtoolsStorage | null
): boolean {
  const params = new URLSearchParams(search);

  if (params.has(DEVTOOLS_QUERY_PARAM)) {
    const value = (params.get(DEVTOOLS_QUERY_PARAM) ?? "").toLowerCase();
    const enabled = !DISABLED_VALUES.has(value);

    try {
      storage?.setItem(DEVTOOLS_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Persisting the choice is a convenience; the flag still applies.
    }

    return enabled;
  }

  try {
    return storage?.getItem(DEVTOOLS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function sessionStorageOrNull(): IDevtoolsStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isDevtoolsRequested(): boolean {
  return resolveDevtoolsEnabled(window.location.search, sessionStorageOrNull());
}
