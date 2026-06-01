/*
 * Mirrors the API's `ErrorEnvelopeSchema` (apps/api/src/lib/errors/
 * error.schema.ts). `details` carries open-shape payload that domain-
 * specific errors put there — e.g. `limitExceeded` sets
 * `{ feature, current, limit }` so the upgrade prompt can render
 * without a second request. Without this field the middleware drops
 * the payload and the UI silently loses the context.
 */
export interface IApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
}
