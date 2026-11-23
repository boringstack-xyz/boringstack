import { t } from "elysia";

import { defineNotificationEvent } from "../../../lib/notifications/events/define-event";
import {
  LIFECYCLE_DEDUP_WINDOW_SECONDS,
  lifecycleEmailEnvelope,
  lifecycleEventType,
  type LifecycleStage,
} from "../../lifecycle";

/*
 * Follow-up emails after sign-up. One event per stage, sharing a payload:
 * the lifecycle sweep decides who is due, these decide what the email says.
 * The lifecycle barrel exports the service, which imports this registry back.
 * That cycle is safe only because the barrel lists constants and utils before
 * the service, so they are initialised when the event is defined.
 */
const lifecyclePayload = t.Object({
  firstName: t.String(),
  ctaUrl: t.String({ format: "uri" }),
  unsubscribeUrl: t.String({ format: "uri" }),
  /** Reply-to inbox; empty means noreply, and the copy drops "just reply". */
  replyTo: t.String(),
});

interface ILifecycleCopy {
  subject: string;
  preHeader: string;
  ctaText: string;
  inApp: { title: string; body: string; ctaLabel: string };
}

/*
 * EXAMPLE COPY. Replace with the product's own voice before turning
 * LIFECYCLE_EMAILS_ENABLED on. Templates live in
 * src/templates/email/templates/lifecycle/<stage>/.
 */
const COPY: Record<LifecycleStage, ILifecycleCopy> = {
  "welcome-follow-up": {
    subject: "Thanks for signing up",
    preHeader: "A quick note, and a place to start.",
    ctaText: "Open the dashboard",
    inApp: {
      title: "Thanks for signing up",
      body: "Here is a place to start whenever you are ready.",
      ctaLabel: "Open the dashboard",
    },
  },
};

const defineLifecycleEvent = (stage: LifecycleStage) => {
  const copy = COPY[stage];

  return defineNotificationEvent({
    type: lifecycleEventType(stage),
    schema: lifecyclePayload,
    defaultChannels: ["email", "in-app"],
    dedup: {
      key: ({ recipientUserId }) => `lifecycle:${stage}:${recipientUserId}`,
      windowSeconds: LIFECYCLE_DEDUP_WINDOW_SECONDS,
    },
    render: {
      inApp: ({ payload }) => ({ ...copy.inApp, ctaUrl: payload.ctaUrl }),
      email: {
        subject: () => copy.subject,
        templatePath: `lifecycle/${stage}`,
        variables: ({ payload }) => ({
          preHeader: copy.preHeader,
          ctaText: copy.ctaText,
          firstName: payload.firstName === "" ? "there" : payload.firstName,
          ctaUrl: payload.ctaUrl,
          unsubscribeUrl: payload.unsubscribeUrl,
          canReply: payload.replyTo !== "",
        }),
        envelope: ({ payload }) => lifecycleEmailEnvelope(payload),
      },
    },
  });
};

export const lifecycleWelcomeFollowUpEvent =
  defineLifecycleEvent("welcome-follow-up");

/** One registered event per stage, keyed the way the lifecycle sweep asks. */
export const LIFECYCLE_EVENTS = {
  "welcome-follow-up": lifecycleWelcomeFollowUpEvent,
} as const;
