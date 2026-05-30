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

export interface IListForAccountInput {
  accountId: string;
  /** Newest-first; capped at 100. Defaults to 50. */
  limit?: number;
}

export interface IAuditLogEntry {
  id: string;
  action: string;
  resource: string | null;
  metadata: unknown;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
}

export interface IListForAccountResult {
  entries: IAuditLogEntry[];
}
