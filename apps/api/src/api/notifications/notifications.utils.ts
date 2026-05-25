import type { InferSelectModel } from "drizzle-orm";
import type { notification } from "../../clients/postgres/schema";
import { NOTIFICATIONS_DEFAULT_LIMIT } from "./notifications.constants";
import type {
  IPublicNotification,
  NotificationStatus,
} from "./notifications.types";

type INotificationRow = InferSelectModel<typeof notification>;

const VALID_STATUSES: readonly NotificationStatus[] = [
  "unread",
  "read",
  "archived",
];

/** Coerce an arbitrary string to a known `NotificationStatus`, defaulting to `unread`. */
export const narrowNotificationStatus = (raw: string): NotificationStatus => {
  const found = VALID_STATUSES.find((status) => status === raw);

  return found ?? "unread";
};

/** Parses a `limit` query-string param, falling back to the feature default. */
export const parseNotificationsLimit = (raw: string | undefined): number => {
  if (raw === undefined || raw === "") {
    return NOTIFICATIONS_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return NOTIFICATIONS_DEFAULT_LIMIT;
  }

  return parsed;
};

/** Read a string field from a jsonb-derived record, defaulting to empty. */
export const readRenderedString = (
  rendered: Record<string, unknown>,
  key: string
): string => {
  const value = rendered[key];

  return typeof value === "string" ? value : "";
};

/** Read a nullable string field from a jsonb-derived record. */
export const readRenderedNullableString = (
  rendered: Record<string, unknown>,
  key: string
): string | null => {
  const value = rendered[key];

  return typeof value === "string" ? value : null;
};

/**
 * Narrow Drizzle's `unknown` jsonb column to a record without TS
 * assertions. Returns an empty record on null / arrays / scalars.
 */
export const toRenderedRecord = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const copy: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    copy[key] = value;
  }

  return copy;
};

/** Convert a Drizzle row into the public-facing notification shape. */
export const toPublicNotification = (
  row: INotificationRow
): IPublicNotification => {
  const rendered = toRenderedRecord(row.rendered);

  return {
    id: row.id,
    eventType: row.eventType,
    title: readRenderedString(rendered, "title"),
    body: readRenderedString(rendered, "body"),
    ctaUrl: readRenderedNullableString(rendered, "ctaUrl"),
    ctaLabel: readRenderedNullableString(rendered, "ctaLabel"),
    status: narrowNotificationStatus(row.status),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
};
