import { t } from "elysia";

const CampaignSchema = t.Object({
  id: t.String(),
  subject: t.String(),
  body: t.String(),
  status: t.String(),
  recipientCount: t.Number(),
  failedCount: t.Number(),
  createdAt: t.String(),
  sentAt: t.Nullable(t.String()),
});

export const CampaignListQuery = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
});

export const CampaignListResponse = t.Object({
  campaigns: t.Array(CampaignSchema),
  timestamp: t.String(),
});

export const CreateCampaignBody = t.Object({
  subject: t.String({ minLength: 1, maxLength: 200 }),
  body: t.String({ minLength: 1, maxLength: 20_000 }),
});

export const CampaignResponse = t.Object({
  campaign: CampaignSchema,
  timestamp: t.String(),
});

export const CampaignPreviewResponse = t.Object({
  campaign: CampaignSchema,
  recipientCount: t.Number(),
  truncated: t.Boolean(),
  timestamp: t.String(),
});

export const CampaignIdParams = t.Object({
  id: t.String({ format: "uuid" }),
});
