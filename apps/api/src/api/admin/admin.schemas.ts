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
