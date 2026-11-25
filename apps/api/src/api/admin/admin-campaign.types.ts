import type { INotificationDispatchJobData } from "../../queues/notification-dispatch/notification-dispatch.types";

export interface IAdminCampaignRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  recipientCount: number;
  failedCount: number;
  createdByUserId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminCampaign {
  id: string;
  subject: string;
  body: string;
  status: string;
  recipientCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
}

export interface IAdminCampaignPreview {
  campaign: IAdminCampaign;
  recipientCount: number;
  truncated: boolean;
}

export interface ICreateCampaignInput {
  subject: string;
  body: string;
}

/** Hands one job to the notification-dispatch queue. `jobId` dedups a retry. */
export type CampaignEnqueue = (
  data: INotificationDispatchJobData,
  jobId: string
) => Promise<void>;

export interface ISegmentPerson {
  userId: string;
  firstName: string;
}
