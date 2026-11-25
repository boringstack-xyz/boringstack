import { t } from "elysia";

import {
  CAMPAIGN_DEDUP_WINDOW_SECONDS,
  CAMPAIGN_MESSAGE_EVENT_TYPE,
} from "../../../lib/campaigns/campaign.constants";
import { defineNotificationEvent } from "../../../lib/notifications/events/define-event";
import { lifecycleEmailEnvelope } from "../../lifecycle";

/*
 * One marketing message from the operator dashboard. The campaign service
 * builds the payload per recipient, so `unsubscribeUrl` names that person.
 * The envelope is the lifecycle one: it carries List-Unsubscribe and the
 * RFC 8058 one-click header, and the link goes to the same unsubscribe page.
 */
const campaignPayload = t.Object({
  campaignId: t.String({ format: "uuid" }),
  subject: t.String({ maxLength: 200 }),
  body: t.String({ maxLength: 20_000 }),
  firstName: t.String(),
  unsubscribeUrl: t.String({ format: "uri" }),
  /** Reply-to inbox; empty means noreply. */
  replyTo: t.String(),
});

export const campaignMessageEvent = defineNotificationEvent({
  type: CAMPAIGN_MESSAGE_EVENT_TYPE,
  schema: campaignPayload,
  defaultChannels: ["email"],
  dedup: {
    key: ({ recipientUserId, payload }) =>
      `campaign:${payload.campaignId}:${recipientUserId}`,
    windowSeconds: CAMPAIGN_DEDUP_WINDOW_SECONDS,
  },
  render: {
    email: {
      subject: ({ payload }) => payload.subject,
      templatePath: "campaign/message",
      variables: ({ payload }) => ({
        preHeader: "",
        body: payload.body,
        firstName: payload.firstName === "" ? "there" : payload.firstName,
        unsubscribeUrl: payload.unsubscribeUrl,
        canReply: payload.replyTo !== "",
      }),
      envelope: ({ payload }) => lifecycleEmailEnvelope(payload),
    },
  },
});
