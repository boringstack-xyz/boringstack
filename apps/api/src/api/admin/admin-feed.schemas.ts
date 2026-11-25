import { t } from "elysia";

/** A feed item key such as `queue-failed:email-delivery`. */
export const FeedKeyParams = t.Object({
  key: t.String({ minLength: 1, maxLength: 200, pattern: "^[a-z0-9:_-]+$" }),
});

export const FeedListResponse = t.Object({
  items: t.Array(
    t.Object({
      key: t.String(),
      title: t.String(),
      count: t.Number(),
    })
  ),
  timestamp: t.String(),
});

export const SnoozeFeedBody = t.Object({
  hours: t.Number({ minimum: 1, maximum: 168 }),
});

export const SnoozeFeedResponse = t.Object({
  snoozedUntil: t.String(),
  timestamp: t.String(),
});

export const FeedActionResponse = t.Object({
  timestamp: t.String(),
});
