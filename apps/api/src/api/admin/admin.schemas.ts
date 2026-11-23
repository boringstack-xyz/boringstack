import { t } from "elysia";

export const QueueStatsSchema = t.Object({
  name: t.String(),
  counts: t.Object({
    waiting: t.Number(),
    active: t.Number(),
    completed: t.Number(),
    failed: t.Number(),
    delayed: t.Number(),
    paused: t.Number(),
  }),
});

export const QueueStatsListResponse = t.Object({
  queues: t.Array(QueueStatsSchema),
  timestamp: t.String(),
});

export const AuditFeedQuery = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  before: t.Optional(t.String({ format: "date-time" })),
});

export const AuditFeedEntrySchema = t.Object({
  id: t.String(),
  action: t.String(),
  resource: t.Nullable(t.String()),
  actorUserId: t.Nullable(t.String()),
  targetAccountId: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const AuditFeedResponse = t.Object({
  entries: t.Array(AuditFeedEntrySchema),
  timestamp: t.String(),
});
