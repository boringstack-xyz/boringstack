import { t } from "elysia";

export const ActivityItemSchema = t.Object({
  id: t.String(),
  title: t.String(),
  timestamp: t.String(),
});

export const DashboardSummarySchema = t.Object({
  totalEvents: t.Number(),
  recentActivity: t.Array(ActivityItemSchema),
});

export const ActivityPageSchema = t.Object({
  items: t.Array(ActivityItemSchema),
  nextCursor: t.Union([t.String(), t.Null()]),
});

export const ActivityQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});
