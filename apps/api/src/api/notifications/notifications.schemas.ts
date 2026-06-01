import { t } from "elysia";

export const NotificationStatusSchema = t.Union([
  t.Literal("unread"),
  t.Literal("read"),
  t.Literal("archived"),
]);

export const PublicNotificationSchema = t.Object({
  id: t.String(),
  eventType: t.String(),
  title: t.String(),
  body: t.String(),
  ctaUrl: t.Union([t.String(), t.Null()]),
  ctaLabel: t.Union([t.String(), t.Null()]),
  status: NotificationStatusSchema,
  readAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

export const NotificationListResponse = t.Object({
  items: t.Array(PublicNotificationSchema),
  nextCursor: t.Union([t.String(), t.Null()]),
});

export const ListNotificationsQuerySchema = t.Object({
  status: t.Optional(NotificationStatusSchema),
  limit: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
});

export const UpdateNotificationParamsSchema = t.Object({
  id: t.String(),
});

export const UpdateNotificationBodySchema = t.Object({
  status: t.Union([t.Literal("read"), t.Literal("archived")]),
});

export const MarkAllReadResponse = t.Object({
  updated: t.Number(),
});

const PreferenceItemSchema = t.Object({
  eventType: t.String({ maxLength: 100 }),
  channel: t.String({ maxLength: 30 }),
  enabled: t.Boolean(),
});

export const PreferencesResponse = t.Object({
  items: t.Array(PreferenceItemSchema),
});

export const UpdatePreferencesBodySchema = t.Object({
  preferences: t.Array(PreferenceItemSchema, { minItems: 0, maxItems: 200 }),
});
