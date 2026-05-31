import { createHmac, timingSafeEqual } from "node:crypto";

import {
  EMAIL_SUPPRESSION_PROVIDERS,
  EMAIL_SUPPRESSION_REASONS,
  type EmailSuppressionReason,
  emailSuppressionService,
  type IRecordSuppressionInput,
} from "../../lib/email";
import { ApiErrors } from "../../lib/errors";
import { logger } from "../../config/logger";
import { nowMs } from "../../lib/time/now";
import type {
  IResendEventBase,
  IResendVerifiedHeaders,
  IResendVerifyOptions,
} from "./resend.types";

const DEFAULT_TOLERANCE_SECONDS = 300;
const WHSEC_PREFIX = "whsec_";

/**
 * Read the three svix headers Resend signs each event with. Any missing
 * header is fatal — a Resend webhook always carries the trio.
 */
export const extractResendHeaders = (
  headers: Record<string, string | undefined>
): IResendVerifiedHeaders => {
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (
    svixId === undefined ||
    svixId === "" ||
    svixTimestamp === undefined ||
    svixTimestamp === "" ||
    svixSignature === undefined ||
    svixSignature === ""
  ) {
    throw ApiErrors.validation("Missing svix webhook headers");
  }

  return { svixId, svixTimestamp, svixSignature };
};

const decodeWebhookSecret = (secret: string): Buffer => {
  if (!secret.startsWith(WHSEC_PREFIX)) {
    throw ApiErrors.internal("RESEND_WEBHOOK_SECRET must start with 'whsec_'");
  }

  return Buffer.from(secret.slice(WHSEC_PREFIX.length), "base64");
};

/**
 * Parse svix-signature header. Format is one or more space-separated
 * version-prefixed signatures: `v1,<base64> v1,<base64rotated>`. We
 * accept the message when any v1 entry matches.
 */
const extractV1Signatures = (header: string): Buffer[] => {
  const out: Buffer[] = [];

  for (const part of header.split(" ")) {
    const [version, sig] = part.split(",");

    if (version === "v1" && sig !== undefined && sig !== "") {
      out.push(Buffer.from(sig, "base64"));
    }
  }

  return out;
};

const constantTimeContains = (
  candidates: Buffer[],
  expected: Buffer
): boolean => {
  for (const candidate of candidates) {
    if (candidate.length !== expected.length) {
      continue;
    }

    if (timingSafeEqual(candidate, expected)) {
      return true;
    }
  }

  return false;
};

/**
 * Verify a Resend webhook payload. Throws an `ApiError` on signature
 * mismatch or stale timestamp. Returns the parsed JSON body on success
 * so callers don't have to re-parse.
 */
export const verifyResendWebhook = (
  rawBody: string,
  headers: IResendVerifiedHeaders,
  options: IResendVerifyOptions
): IResendEventBase => {
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((options.now?.() ?? nowMs()) / 1000);
  const timestampSeconds = Number.parseInt(headers.svixTimestamp, 10);

  if (Number.isNaN(timestampSeconds)) {
    throw ApiErrors.validation("Invalid svix-timestamp header");
  }

  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    throw ApiErrors.unauthorized("Resend webhook timestamp outside tolerance");
  }

  const secret = decodeWebhookSecret(options.secret);
  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedContent).digest();
  const candidates = extractV1Signatures(headers.svixSignature);

  if (candidates.length === 0) {
    throw ApiErrors.unauthorized("No v1 svix signature present");
  }

  if (!constantTimeContains(candidates, expected)) {
    throw ApiErrors.unauthorized("Resend webhook signature mismatch");
  }

  return parseResendBody(rawBody);
};

const parseResendBody = (rawBody: string): IResendEventBase => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch (error: unknown) {
    throw ApiErrors.validation(
      `Resend webhook body is not a valid JSON event: ${
        error instanceof Error ? error.message : "unknown"
      }`
    );
  }

  if (!isResendEventShape(parsed)) {
    throw ApiErrors.validation(
      "Resend webhook body is missing a string `type` field"
    );
  }

  return parsed;
};

const isResendEventShape = (value: unknown): value is IResendEventBase => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (!("type" in value)) {
    return false;
  }

  return typeof Reflect.get(value, "type") === "string";
};

/**
 * Map a Resend event to a suppression reason when relevant. Returns
 * `null` for event types that are not deliverability signals (delivered,
 * opened, clicked, …).
 *
 * Resend's `email.bounced` covers both hard and soft bounces. Their
 * `bounce.type` field distinguishes them. We treat any value containing
 * "hard" (case-insensitive) as a permanent suppression. Anything else
 * is left for the natural per-job retry envelope without persisting a
 * suppression row.
 */
export const resendEventToReason = (
  event: IResendEventBase
): EmailSuppressionReason | null => {
  if (event.type === "email.complained") {
    return EMAIL_SUPPRESSION_REASONS.COMPLAINT;
  }

  if (event.type !== "email.bounced") {
    return null;
  }

  const bounceType = event.data?.bounce?.type ?? "";

  return bounceType.toLowerCase().includes("hard")
    ? EMAIL_SUPPRESSION_REASONS.HARD_BOUNCE
    : null;
};

const extractRecipient = (event: IResendEventBase): string | null => {
  const to = event.data?.to;

  if (Array.isArray(to)) {
    return typeof to[0] === "string" && to[0] !== "" ? to[0] : null;
  }

  if (typeof to === "string" && to !== "") {
    return to;
  }

  return null;
};

/**
 * Side-effect: persist a suppression row for a Resend event when the
 * event maps to a permanent verdict. No-op for events that aren't a
 * deliverability signal. Returns the number of rows actually inserted
 * so route handlers can include it in the ACK response.
 */
export const applyResendEvent = async (
  event: IResendEventBase
): Promise<number> => {
  const reason = resendEventToReason(event);

  if (reason === null) {
    return 0;
  }

  const email = extractRecipient(event);

  if (email === null) {
    logger.warn("Resend deliverability event without recipient address", {
      event: "webhook.resend.recipient_missing",
      type: event.type,
    });

    return 0;
  }

  const input: IRecordSuppressionInput = {
    email,
    reason,
    provider: EMAIL_SUPPRESSION_PROVIDERS.RESEND,
    providerMessageId: event.data?.email_id ?? undefined,
    metadata: {
      type: event.type,
      bounceType: event.data?.bounce?.type ?? null,
      bounceMessage: event.data?.bounce?.message ?? null,
    },
  };
  const result = await emailSuppressionService.record(input);

  return result.recorded ? 1 : 0;
};
