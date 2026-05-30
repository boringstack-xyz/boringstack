/**
 * Resend webhook event shapes we react to. Resend emits many more event
 * types (delivery, opened, clicked, …) — we only care about the two
 * deliverability signals that drive suppression.
 *
 * Reference: https://resend.com/docs/dashboard/webhooks/event-types
 */
export interface IResendEventBase {
  type: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: {
      type?: string;
      message?: string;
    };
  };
}

export interface IResendVerifiedHeaders {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}

export interface IResendVerifyOptions {
  /** Webhook signing secret (`whsec_<base64>`). */
  secret: string;
  /** Reject timestamps older than this many seconds. Defaults to 300. */
  toleranceSeconds?: number;
  /** Override "now" for deterministic tests. */
  now?: () => number;
}
