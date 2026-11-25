import type { IAdminCampaign, IAdminCampaignRow } from "./admin-campaign.types";

export const toCampaign = (row: IAdminCampaignRow): IAdminCampaign => ({
  id: row.id,
  subject: row.subject,
  body: row.body,
  status: row.status,
  recipientCount: row.recipientCount,
  failedCount: row.failedCount,
  createdAt: row.createdAt,
  sentAt: row.sentAt,
});
