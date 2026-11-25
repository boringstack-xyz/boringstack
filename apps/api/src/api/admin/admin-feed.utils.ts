import type { IAdminFeedItemState, IFeedItemDraft } from "./admin-feed.types";

export const FEED_QUEUE_FAILED_PREFIX = "queue-failed:";
export const FEED_MAX_SNOOZE_HOURS = 168;
export const HOUR_MS = 3_600_000;

/**
 * Whether an item is shown. A resolved item stays hidden until its count
 * rises above the count observed at resolve time; a snoozed item stays
 * hidden until `snoozedUntil`.
 */
export const isFeedItemVisible = (
  item: IFeedItemDraft,
  state: IAdminFeedItemState | undefined,
  nowEpochMs: number
): boolean => {
  if (state === undefined) {
    return true;
  }

  if (state.state === "snoozed") {
    return (
      state.snoozedUntil === null ||
      Date.parse(state.snoozedUntil) <= nowEpochMs
    );
  }

  return item.count > state.observedCount;
};

export const isValidSnoozeHours = (hours: number): boolean =>
  Number.isInteger(hours) && hours >= 1 && hours <= FEED_MAX_SNOOZE_HOURS;
