/** Notification event type of one operator campaign message. */
export const CAMPAIGN_MESSAGE_EVENT_TYPE = "campaign.message";

/** A campaign reaches each person once; the window outlives any campaign. */
export const CAMPAIGN_DEDUP_WINDOW_SECONDS = 100 * 365 * 24 * 3_600;
