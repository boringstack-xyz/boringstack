/**
 * Follow-up emails a person gets after signing up, keyed by what they have
 * (or haven't) done. Each stage goes out at most once per person, ever.
 *
 * `welcome-follow-up` is an EXAMPLE stage. Replace it, and its event, copy
 * and template, with your product's own stages.
 */
export const LIFECYCLE_STAGES = ["welcome-follow-up"] as const;

/** Notification event type prefix; every stage is `lifecycle.<stage>`. */
export const LIFECYCLE_EVENT_PREFIX = "lifecycle.";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/*
 * Each stage fires inside a window measured from sign-up. The upper bound
 * keeps people who signed up long before these emails existed from getting
 * a "thanks for signing up" note weeks later.
 */
export const LIFECYCLE_WINDOWS = {
  "welcome-follow-up": { fromMs: 2 * DAY_MS, toMs: 7 * DAY_MS },
} as const satisfies Record<
  (typeof LIFECYCLE_STAGES)[number],
  { fromMs: number; toMs: number }
>;

/** No more than one follow-up email per person in this span. */
export const LIFECYCLE_MIN_GAP_MS = DAY_MS;

/** Dedup rows for "once ever": a century outlives any account. */
export const LIFECYCLE_DEDUP_WINDOW_SECONDS = 100 * 365 * 24 * 3_600;

/** Cap per stage per sweep, so a backlog drains over a few ticks. */
export const LIFECYCLE_BATCH_SIZE = 200;

export const LIFECYCLE_UNSUBSCRIBE_PURPOSE = "lifecycle-unsubscribe";

export const LIFECYCLE_UTM_MEDIUM = "lifecycle";

/*
 * Stages are tried in this order each sweep, and a person gets at most one
 * of them per sweep, so the one closest to a decision wins.
 */
export const LIFECYCLE_SWEEP_ORDER = ["welcome-follow-up"] as const;

/** Where each email's button goes, under the app's URL. */
export const LIFECYCLE_CTA_PATH = {
  "welcome-follow-up": "/dashboard",
} as const satisfies Record<(typeof LIFECYCLE_STAGES)[number], string>;
