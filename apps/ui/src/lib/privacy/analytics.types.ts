import type {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAM_KEYS
} from "./analytics.constants";

export type TAnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export type TAnalyticsParams = Partial<
  Record<(typeof ANALYTICS_PARAM_KEYS)[number], string | number>
>;

export type TAnalyticsValue = string | number;
