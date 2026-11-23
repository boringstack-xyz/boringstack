/*
 * Example moments. Each person is asked at most once per moment. Replace these
 * with the points in your product where a question is worth asking.
 */
export const FEEDBACK_MOMENTS = ["onboarded", "upgraded"] as const;

export const FEEDBACK_MOMENT_PATTERN = "^(onboarded|upgraded)$";

export const FEEDBACK_STATES = ["shown", "answered", "dismissed"] as const;

export const FEEDBACK_ANSWER_MAX_LENGTH = 1000;

export const FEEDBACK_RATE_LIMIT = {
  max: 20,
  durationMs: 60_000,
} as const;
