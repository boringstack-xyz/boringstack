import { and, asc, desc, eq, isNotNull, notLike } from "drizzle-orm";

import { db } from "../../clients/postgres";
import {
  emailCampaignRecipients,
  emailCampaigns,
  users,
} from "../../clients/postgres/schema";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { CAMPAIGN_MESSAGE_EVENT_TYPE } from "../../lib/campaigns/campaign.constants";
import { ApiErrors, getErrorMessage } from "../../lib/errors";
import { SYNTHETIC_EMAIL_DOMAIN } from "../../lib/synthetic";
import { now } from "../../lib/time/now";
import { enqueueNotificationDispatchJob } from "../../queues/notification-dispatch/notification-dispatch.enqueue";
import { signUnsubscribeToken, unsubscribeUrl } from "../lifecycle";

import {
  CAMPAIGN_LIST_DEFAULT_LIMIT,
  CAMPAIGN_LIST_MAX_LIMIT,
  CAMPAIGN_MAX_RECIPIENTS,
  CAMPAIGN_STATUS,
} from "./admin-campaign.constants";
import type {
  CampaignEnqueue,
  ISegmentPerson,
  IAdminCampaign,
  IAdminCampaignPreview,
  IAdminCampaignRow,
  ICreateCampaignInput,
} from "./admin-campaign.types";
import { toCampaign } from "./admin-campaign.utils";

/**
 * Operator-written marketing email. The segment is every verified, non-robot
 * person with `marketing_consent_at` set. Each send goes through the
 * notification-dispatch queue and so the existing email delivery; the
 * List-Unsubscribe header and the unsubscribe link come from the lifecycle
 * framework, and unsubscribing clears consent so the next send skips them.
 *
 * A campaign moves draft -> sending -> sent exactly once. Every recipient row
 * is inserted before its job is enqueued, so a retried send skips people it
 * already reached. A crash mid-send leaves the campaign at `sending`; it is
 * not resent automatically.
 */
export class AdminCampaignService {
  constructor(
    private readonly enqueue: CampaignEnqueue = enqueueNotificationDispatchJob
  ) {}

  async list(limit = CAMPAIGN_LIST_DEFAULT_LIMIT): Promise<IAdminCampaign[]> {
    const capped = Math.min(Math.max(limit, 1), CAMPAIGN_LIST_MAX_LIMIT);
    const rows = await db
      .select()
      .from(emailCampaigns)
      .orderBy(desc(emailCampaigns.createdAt), desc(emailCampaigns.id))
      .limit(capped);

    return rows.map(toCampaign);
  }

  async create(
    input: ICreateCampaignInput & { operatorUserId: string }
  ): Promise<IAdminCampaign> {
    const [row] = await db
      .insert(emailCampaigns)
      .values({
        subject: input.subject,
        body: input.body,
        createdByUserId: input.operatorUserId,
      })
      .returning();

    if (row === undefined) {
      throw ApiErrors.database("Failed to create campaign");
    }

    void auditLogService.record({
      userId: input.operatorUserId,
      action: AUDIT_ACTIONS.ADMIN_CAMPAIGN_CREATED,
      resource: `campaign:${row.id}`,
    });

    return toCampaign(row);
  }

  /** The segment size and the campaign as it would send. Sends nothing. */
  async preview(id: string): Promise<IAdminCampaignPreview> {
    const row = await this.findRow(id);
    const audience = await this.segment();

    return {
      campaign: toCampaign(row),
      recipientCount: Math.min(audience.length, CAMPAIGN_MAX_RECIPIENTS),
      truncated: audience.length > CAMPAIGN_MAX_RECIPIENTS,
    };
  }

  async send(id: string, operatorUserId: string): Promise<IAdminCampaign> {
    const campaign = await this.claim(id);
    const audience = await this.segment();

    let sent = 0;
    let failed = 0;

    for (const person of audience.slice(0, CAMPAIGN_MAX_RECIPIENTS)) {
      if (!(await this.recordRecipient(id, person.userId))) {
        continue;
      }

      try {
        await this.deliver(campaign, person, operatorUserId);
        sent += 1;
      } catch (error: unknown) {
        failed += 1;
        logger.error("Campaign email failed to enqueue", {
          event: "admin.campaign.enqueue_failed",
          campaignId: id,
          recipientUserId: person.userId,
          error: getErrorMessage(error),
        });
      }
    }

    const settled = await this.settle(id, sent, failed);

    void auditLogService.record({
      userId: operatorUserId,
      action: AUDIT_ACTIONS.ADMIN_CAMPAIGN_SENT,
      resource: `campaign:${id}`,
      metadata: { campaignId: id, sent, failed },
    });

    return toCampaign(settled);
  }

  /** Moves draft to sending in one statement; only one caller wins. */
  private async claim(id: string): Promise<IAdminCampaignRow> {
    const [claimed] = await db
      .update(emailCampaigns)
      .set({ status: CAMPAIGN_STATUS.sending, updatedAt: now() })
      .where(
        and(
          eq(emailCampaigns.id, id),
          eq(emailCampaigns.status, CAMPAIGN_STATUS.draft)
        )
      )
      .returning();

    if (claimed === undefined) {
      const existing = await this.findRow(id);

      throw ApiErrors.conflict(
        `Campaign is already ${existing.status}; a campaign is sent once`
      );
    }

    return claimed;
  }

  /** True when this person was newly recorded; false when already reached. */
  private async recordRecipient(
    campaignId: string,
    userId: string
  ): Promise<boolean> {
    const rows = await db
      .insert(emailCampaignRecipients)
      .values({ campaignId, userId })
      .onConflictDoNothing()
      .returning({ id: emailCampaignRecipients.id });

    return rows.length > 0;
  }

  private async deliver(
    campaign: IAdminCampaignRow,
    person: ISegmentPerson,
    operatorUserId: string
  ): Promise<void> {
    const token = signUnsubscribeToken(person.userId, env.JWT_SECRET);

    await this.enqueue(
      {
        eventType: CAMPAIGN_MESSAGE_EVENT_TYPE,
        recipientUserId: person.userId,
        payload: {
          campaignId: campaign.id,
          subject: campaign.subject,
          body: campaign.body,
          firstName: person.firstName,
          unsubscribeUrl: unsubscribeUrl(env.PUBLIC_API_URL, token),
          replyTo: "",
        },
      },
      `campaign:${campaign.id}:${person.userId}`
    );

    void auditLogService.record({
      userId: operatorUserId,
      action: AUDIT_ACTIONS.ADMIN_CAMPAIGN_EMAIL_SENT,
      resource: `campaign:${campaign.id}`,
      metadata: { campaignId: campaign.id, recipientUserId: person.userId },
    });
  }

  private async settle(
    id: string,
    sent: number,
    failed: number
  ): Promise<IAdminCampaignRow> {
    const [done] = await db
      .update(emailCampaigns)
      .set({
        status: CAMPAIGN_STATUS.sent,
        recipientCount: sent,
        failedCount: failed,
        sentAt: now(),
        updatedAt: now(),
      })
      .where(eq(emailCampaigns.id, id))
      .returning();

    if (done === undefined) {
      throw ApiErrors.database("Failed to settle campaign");
    }

    return done;
  }

  private async findRow(id: string): Promise<IAdminCampaignRow> {
    const row = await db.query.emailCampaigns.findFirst({
      where: eq(emailCampaigns.id, id),
    });

    if (row === undefined) {
      throw ApiErrors.notFound("Campaign");
    }

    return row;
  }

  /** Up to one more than the cap, so the caller can tell when it is truncated. */
  private async segment(): Promise<ISegmentPerson[]> {
    return db
      .select({ userId: users.id, firstName: users.firstName })
      .from(users)
      .where(
        and(
          isNotNull(users.marketingConsentAt),
          isNotNull(users.emailVerifiedAt),
          notLike(users.email, `%@${SYNTHETIC_EMAIL_DOMAIN}`)
        )
      )
      .orderBy(asc(users.id))
      .limit(CAMPAIGN_MAX_RECIPIENTS + 1);
  }
}

export const adminCampaignService = new AdminCampaignService();
