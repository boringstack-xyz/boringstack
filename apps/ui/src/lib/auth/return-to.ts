/*
 * Return-to: the in-app path a visitor was heading to when auth stopped them.
 *
 * ProtectedRoute stores the path it bounced from; login, email verification
 * and the OAuth callback read it back after the session exists. The value
 * lives in sessionStorage (per tab) with a short lifetime, so an abandoned
 * attempt does not redirect a much later login.
 *
 * Every value is validated before it is stored or used. Only same-origin
 * absolute paths pass: they must start with a single "/", and contain no
 * control characters or backslashes (browsers strip tabs and newlines from
 * URLs, so "/\t/evil.example" would otherwise become protocol-relative).
 */
import { nowMs } from "@/lib/time/now";

import {
  ORIGIN_PROBE,
  RETURN_TO_MAX_AGE_MS,
  RETURN_TO_STORAGE_KEY
} from "./return-to.constants";
import type { IStoredReturnTo } from "./return-to.types";

export {
  RETURN_TO_MAX_AGE_MS,
  RETURN_TO_STORAGE_KEY
} from "./return-to.constants";

function hasForbiddenCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code < 0x20 || code === 0x7f || value[index] === "\\") {
      return true;
    }
  }

  return false;
}

/** Returns the path when it is a safe same-origin relative path, else null. */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("//") || hasForbiddenCharacter(value)) {
    return null;
  }

  try {
    const resolved = new URL(value, ORIGIN_PROBE);

    return resolved.origin === ORIGIN_PROBE ? value : null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isStoredReturnTo(value: unknown): value is IStoredReturnTo {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "savedAt" in value &&
    typeof value.savedAt === "number"
  );
}

/** Remembers a path for the next auth step. Invalid paths are ignored. */
export function storeReturnTo(value: unknown, at: number = nowMs()): void {
  const path = sanitizeReturnTo(value);
  const storage = getSessionStorage();

  if (path === null || storage === null) {
    return;
  }

  try {
    const entry: IStoredReturnTo = { path, savedAt: at };

    storage.setItem(RETURN_TO_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage can be full or blocked; the default post-auth path still applies.
  }
}

function readStored(at: number): string | null {
  const storage = getSessionStorage();

  if (storage === null) {
    return null;
  }

  try {
    const raw = storage.getItem(RETURN_TO_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isStoredReturnTo(parsed)) {
      return null;
    }

    const isFresh = at - parsed.savedAt <= RETURN_TO_MAX_AGE_MS;

    return isFresh ? sanitizeReturnTo(parsed.path) : null;
  } catch {
    return null;
  }
}

/** Reads the stored path without consuming it. */
export function peekReturnTo(at: number = nowMs()): string | null {
  return readStored(at);
}

/** Reads the stored path and clears it. Call once, after navigating on. */
export function takeReturnTo(at: number = nowMs()): string | null {
  const path = readStored(at);

  clearReturnTo();

  return path;
}

export function clearReturnTo(): void {
  try {
    getSessionStorage()?.removeItem(RETURN_TO_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
