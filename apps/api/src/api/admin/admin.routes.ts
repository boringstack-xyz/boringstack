import { ApiErrors } from "../../lib/errors";
import { now } from "../../lib/time/now";
import { errorHandler } from "../../middleware/error-handler";
import { requireOperator } from "../../middleware/require-operator";
import { getResolvedOperator } from "../../boot/operator";

import { adminAuditService } from "./admin-audit.service";
import { adminCampaignService } from "./admin-campaign.service";
import {
  CampaignIdParams,
  CampaignListQuery,
  CampaignListResponse,
  CampaignPreviewResponse,
  CampaignResponse,
  CreateCampaignBody,
} from "./admin-campaign.schemas";
import { adminFeedService } from "./admin-feed.service";
import {
  FeedActionResponse,
  FeedKeyParams,
  FeedListResponse,
  SnoozeFeedBody,
  SnoozeFeedResponse,
} from "./admin-feed.schemas";
import {
  AuditFeedQuery,
  AuditFeedResponse,
  QueueStatsListResponse,
} from "./admin.schemas";
import { adminService } from "./admin.service";

/** The operator resolved at boot; `requireOperator` has already checked it. */
const operatorId = (): string => {
  const operator = getResolvedOperator();

  if (operator === null) {
    throw ApiErrors.forbidden();
  }

  return operator.id;
};

/*
 * Mounted only by the LAN-only admin process (src/admin.ts), under
 * /api/v1/admin. Never mounted in the public app: see
 * config/app/app.test.ts.
 */
const adminRoutes = requireOperator()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/queues",
    async () => ({
      queues: await adminService.getQueueStats(),
      timestamp: now(),
    }),
    {
      response: QueueStatsListResponse,
      detail: {
        tags: ["Admin"],
        summary: "Per-queue job counts (read-only, operator only)",
      },
    }
  )
  .get(
    "/audit",
    async ({ query }) => ({
      entries: await adminAuditService.listRecent(query),
      timestamp: now(),
    }),
    {
      query: AuditFeedQuery,
      response: AuditFeedResponse,
      detail: {
        tags: ["Admin"],
        summary: "Recent audit-log entries, newest first (operator only)",
      },
    }
  )
  .get(
    "/campaigns",
    async ({ query }) => ({
      campaigns: await adminCampaignService.list(query.limit),
      timestamp: now(),
    }),
    {
      query: CampaignListQuery,
      response: CampaignListResponse,
      detail: {
        tags: ["Admin"],
        summary: "Recent email campaigns, newest first (operator only)",
      },
    }
  )
  .post(
    "/campaigns",
    async ({ body }) => ({
      campaign: await adminCampaignService.create({
        ...body,
        operatorUserId: operatorId(),
      }),
      timestamp: now(),
    }),
    {
      body: CreateCampaignBody,
      response: CampaignResponse,
      detail: {
        tags: ["Admin"],
        summary: "Create a draft email campaign (operator only)",
      },
    }
  )
  .get(
    "/campaigns/:id/preview",
    async ({ params }) => ({
      ...(await adminCampaignService.preview(params.id)),
      timestamp: now(),
    }),
    {
      params: CampaignIdParams,
      response: CampaignPreviewResponse,
      detail: {
        tags: ["Admin"],
        summary: "Segment size and text of a campaign; sends nothing",
      },
    }
  )
  .post(
    "/campaigns/:id/send",
    async ({ params }) => ({
      campaign: await adminCampaignService.send(params.id, operatorId()),
      timestamp: now(),
    }),
    {
      params: CampaignIdParams,
      response: CampaignResponse,
      detail: {
        tags: ["Admin"],
        summary: "Send a draft campaign to the consented segment (once)",
      },
    }
  )
  .get(
    "/feed",
    async () => ({
      items: await adminFeedService.list(),
      timestamp: now(),
    }),
    {
      response: FeedListResponse,
      detail: {
        tags: ["Admin"],
        summary: "Operator action feed: items that need a look (operator only)",
      },
    }
  )
  .post(
    "/feed/:key/resolve",
    async ({ params }) => {
      await adminFeedService.resolve(params.key, operatorId());

      return { timestamp: now() };
    },
    {
      params: FeedKeyParams,
      response: FeedActionResponse,
      detail: {
        tags: ["Admin"],
        summary: "Resolve a feed item until its count rises",
      },
    }
  )
  .post(
    "/feed/:key/snooze",
    async ({ params, body }) => ({
      snoozedUntil: await adminFeedService.snooze(
        params.key,
        body.hours,
        operatorId()
      ),
      timestamp: now(),
    }),
    {
      params: FeedKeyParams,
      body: SnoozeFeedBody,
      response: SnoozeFeedResponse,
      detail: {
        tags: ["Admin"],
        summary: "Snooze a feed item for a number of hours",
      },
    }
  );

export default adminRoutes;
