export interface IAuditFeedInput {
  /** Newest-first page size; the service clamps it to 1..100 and defaults to 50. */
  readonly limit?: number;
  /** ISO timestamp: returns entries strictly older than this, for paging. */
  readonly before?: string;
}

export interface IAuditFeedEntry {
  id: string;
  action: string;
  resource: string | null;
  actorUserId: string | null;
  targetAccountId: string | null;
  createdAt: string;
}
