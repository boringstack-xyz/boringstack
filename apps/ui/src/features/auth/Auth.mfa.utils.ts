import { ApiError } from "@/lib/api/ApiError";

/**
 * Unwrap the `{ success, data }` envelope from a `/auth/mfa/*` response.
 * Centralised so each mutation hook isn't repeating the empty-response
 * guard.
 */
export function unwrapMfaEnvelope<T>(envelope: { data?: T } | undefined): T {
  if (envelope?.data === undefined) {
    throw new ApiError(0, { message: "Empty response" });
  }

  return envelope.data;
}
