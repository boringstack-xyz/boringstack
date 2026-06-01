import { isRecord } from "@/lib/guards/isRecord";

import type {
  ILoginUserEnvelope,
  IMfaRequiredEnvelope
} from "./Auth.session.mutations.utils.types";

/**
 * Pure narrowing helpers for the `/auth/login` response. Kept in a
 * separate module so the mutations file stays hook-only and the
 * module-boundaries plugin can enforce that.
 */
export function isMfaRequiredEnvelope(
  data: unknown
): data is IMfaRequiredEnvelope {
  if (!isRecord(data)) {
    return false;
  }

  return data.mfaRequired === true && typeof data.challengeToken === "string";
}

export function isLoginUserEnvelope(data: unknown): data is ILoginUserEnvelope {
  if (!isRecord(data)) {
    return false;
  }

  return isRecord(data.user);
}
