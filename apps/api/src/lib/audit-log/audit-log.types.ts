import type { AUDIT_ACTIONS } from "./audit-log.constants";

export type AuditAction =
  | (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
  | (string & {});

export interface IAuditWriteResult {
  success: boolean;
}

export interface IAuditEventInput {
  /** Actor user id. `null` when the action is system-initiated. */
  userId: string | null;
  /** Canonical action name from `AUDIT_ACTIONS` (or a project-specific string). */
  action: AuditAction;
  /** Optional resource identifier — e.g. `"user:7c3..."`. */
  resource?: string;
  /** Small structured payload. Avoid storing PII or secrets here. */
  metadata?: Record<string, unknown>;
  /** Originating IP, when the call site has access to the request. */
  ip?: string;
  /** User-Agent header, when available. */
  userAgent?: string;
}
