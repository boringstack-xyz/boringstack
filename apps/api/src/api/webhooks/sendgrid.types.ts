/**
 * SendGrid Event Webhook payloads. SendGrid POSTs an array of event
 * objects per call (batched). We model only the fields we read.
 *
 * Reference: https://docs.sendgrid.com/for-developers/tracking-events/event
 */
export interface ISendGridEvent {
  email?: string;
  event?: string;
  /** Event-specific subtype, e.g. "bounce" → "bounce" | "blocked". */
  type?: string;
  /** SMTP enhanced status code, e.g. "5.1.1". */
  status?: string;
  reason?: string;
  sg_message_id?: string;
}

export interface ISendGridVerifiedHeaders {
  signature: string;
  timestamp: string;
}

export interface ISendGridVerifyOptions {
  /** PEM-encoded ECDSA P-256 public key. */
  publicKeyPem: string;
  /** Reject timestamps older than this many seconds. Defaults to 600. */
  toleranceSeconds?: number;
  now?: () => number;
}
