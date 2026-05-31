import { createPublicKey, createVerify } from "node:crypto";

import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  type EmailSuppressionReason,
  emailSuppressionService,
} from "../../lib/email";
import { ApiErrors } from "../../lib/errors";
import { logger } from "../../config/logger";
import { nowMs } from "../../lib/time/now";
import type {
  ISendGridEvent,
  ISendGridVerifiedHeaders,
  ISendGridVerifyOptions,
} from "./sendgrid.types";

const DEFAULT_TOLERANCE_SECONDS = 600;
const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

export const extractSendGridHeaders = (
  headers: Record<string, string | undefined>
): ISendGridVerifiedHeaders => {
  const signature = headers[SIGNATURE_HEADER];
  const timestamp = headers[TIMESTAMP_HEADER];

  if (
    signature === undefined ||
    signature === "" ||
    timestamp === undefined ||
    timestamp === ""
  ) {
    throw ApiErrors.validation("Missing SendGrid signed-event webhook headers");
  }

  return { signature, timestamp };
};

/**
 * Verify a SendGrid Event Webhook payload using the configured ECDSA
 * P-256 public key. SendGrid signs `${timestamp}${rawBody}` (no
 * separator) and ships the signature as base64 in the
 * `X-Twilio-Email-Event-Webhook-Signature` header.
 */
export const verifySendGridWebhook = (
  rawBody: string,
  headers: ISendGridVerifiedHeaders,
  options: ISendGridVerifyOptions
): ISendGridEvent[] => {
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((options.now?.() ?? nowMs()) / 1000);
  const timestampSeconds = Number.parseInt(headers.timestamp, 10);

  if (Number.isNaN(timestampSeconds)) {
    throw ApiErrors.validation("Invalid SendGrid webhook timestamp header");
  }

  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    throw ApiErrors.unauthorized(
      "SendGrid webhook timestamp outside tolerance"
    );
  }

  const key = createPublicKey({
    key: options.publicKeyPem,
    format: "pem",
  });
  const verifier = createVerify("sha256");

  verifier.update(`${headers.timestamp}${rawBody}`);

  const signature = Buffer.from(headers.signature, "base64");
  const valid = verifier.verify({ key, dsaEncoding: "der" }, signature);

  if (!valid) {
    throw ApiErrors.unauthorized("SendGrid webhook signature mismatch");
  }

  return parseSendGridBody(rawBody);
};

const parseSendGridBody = (rawBody: string): ISendGridEvent[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch (error: unknown) {
    throw ApiErrors.validation(
      `SendGrid webhook body is not a valid JSON array: ${
        error instanceof Error ? error.message : "unknown"
      }`
    );
  }

  if (!Array.isArray(parsed)) {
    throw ApiErrors.validation("SendGrid webhook body must be a JSON array");
  }

  return parsed.filter(isSendGridEventShape);
};

const isSendGridEventShape = (value: unknown): value is ISendGridEvent =>
  value !== null && typeof value === "object";

/**
 * Map a SendGrid event to a suppression reason. SendGrid splits hard
 * vs soft bounces via the `type` field on `event=bounce`. We also treat
 * `dropped` with reason `Bounced Address` (or `Invalid SMTPAPI header`)
 * as a permanent verdict — those rejections happen because SendGrid's
 * own suppression engine refused the send.
 */
export const sendGridEventToReason = (
  event: ISendGridEvent
): EmailSuppressionReason | null => {
  switch (event.event) {
    case "spamreport":
      return EMAIL_SUPPRESSION_REASONS.COMPLAINT;

    case "bounce": {
      const type = (event.type ?? "").toLowerCase();

      if (type === "bounce" || type === "blocked") {
        return EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE;
      }

      return null;
    }

    case "dropped": {
      const reason = (event.reason ?? "").toLowerCase();

      if (reason.includes("bounced address") || reason.includes("invalid")) {
        return EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE;
      }

      return null;
    }

    default:
      return null;
  }
};

export const applySendGridEvent = async (
  event: ISendGridEvent
): Promise<number> => {
  const reason = sendGridEventToReason(event);

  if (reason === null) {
    return 0;
  }

  const email = event.email ?? "";

  if (email === "") {
    logger.warn("SendGrid deliverability event without recipient address", {
      event: "webhook.sendgrid.recipient_missing",
      type: event.event,
    });

    return 0;
  }

  const result = await emailSuppressionService.record({
    email,
    reason,
    provider: EMAIL_SUPPRESSION_PROVIDERS.SENDGRID,
    providerMessageId: event.sg_message_id ?? undefined,
    metadata: {
      event: event.event,
      type: event.type ?? null,
      status: event.status ?? null,
      reason: event.reason ?? null,
    },
  });

  return result.recorded ? 1 : 0;
};
