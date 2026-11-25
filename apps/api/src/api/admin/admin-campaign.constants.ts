/** Most people one campaign reaches. A larger segment is reported as truncated. */
export const CAMPAIGN_MAX_RECIPIENTS = 1000;

export const CAMPAIGN_STATUS = {
  draft: "draft",
  sending: "sending",
  sent: "sent",
} as const;

export const CAMPAIGN_LIST_DEFAULT_LIMIT = 20;
export const CAMPAIGN_LIST_MAX_LIMIT = 100;
