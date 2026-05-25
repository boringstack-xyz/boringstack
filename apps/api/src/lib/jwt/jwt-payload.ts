import type { AuthJWTPayloadResult } from "./jwt-payload.types";

export const parseAuthJWTPayload = (raw: unknown): AuthJWTPayloadResult => {
  if (raw === false || typeof raw !== "object" || raw === null) {
    return { kind: "invalid" };
  }

  if (!("id" in raw) || !("aid" in raw)) {
    return { kind: "invalid" };
  }

  const { id, aid } = raw;

  if (typeof id !== "string" || typeof aid !== "string") {
    return { kind: "invalid" };
  }

  return { kind: "ok", userId: id, accountId: aid };
};
