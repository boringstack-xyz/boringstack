import { z } from "zod";

export const CampaignSchema = z.object({
  id: z.string(),
  subject: z.string(),
  body: z.string(),
  status: z.string(),
  recipientCount: z.number(),
  failedCount: z.number(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});

export const CampaignListResponseSchema = z.object({
  campaigns: z.array(CampaignSchema),
  timestamp: z.string(),
});

export const CampaignResponseSchema = z.object({
  campaign: CampaignSchema,
  timestamp: z.string(),
});

export const CampaignPreviewResponseSchema = z.object({
  campaign: CampaignSchema,
  recipientCount: z.number(),
  truncated: z.boolean(),
  timestamp: z.string(),
});

export const FeedListResponseSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      count: z.number(),
    })
  ),
  timestamp: z.string(),
});

export const SnoozeResponseSchema = z.object({
  snoozedUntil: z.string(),
  timestamp: z.string(),
});

export const FeedActionResponseSchema = z.object({
  timestamp: z.string(),
});

export type ICampaign = z.infer<typeof CampaignSchema>;
export type IFeedItem = z.infer<typeof FeedListResponseSchema>["items"][number];
