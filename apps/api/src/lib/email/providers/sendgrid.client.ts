import { ApiErrors } from "../../errors";
import { EMAIL_REQUEST_TIMEOUT_MS } from "../email.constants";
import { SENDGRID_SEND_URL } from "./sendgrid.constants";
import type {
  ISendGridMailClient,
  ISendGridMessage,
  ISendGridResponse,
} from "./sendgrid.types";

/*
 * SendGrid's v3 "send" endpoint called directly. Replaces @sendgrid/mail,
 * whose dependency tree (axios, form-data, follow-redirects, deepmerge)
 * kept raising advisories for one JSON POST. Same shape as the old client:
 * resolves with the response headers, rejects with SendGrid's error text so
 * suppression detection keeps working.
 */
export function createSendGridClient(): ISendGridMailClient {
  let apiKey = "";

  return {
    setApiKey: (key: string) => {
      apiKey = key;
    },
    send: async (
      message: ISendGridMessage
    ): Promise<readonly [ISendGridResponse, unknown]> => {
      const response = await fetch(SENDGRID_SEND_URL, {
        method: "POST",
        signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendGridPayload(message)),
      });

      if (!response.ok) {
        const body = await response.text();

        throw ApiErrors.externalService(
          `SendGrid answered ${String(response.status)}: ${body.slice(0, 500)}`
        );
      }

      return [{ headers: Object.fromEntries(response.headers) }, null];
    },
  };
}

/* The v3 mail/send body for one recipient, HTML plus optional text. */
export function sendGridPayload(message: ISendGridMessage) {
  return {
    personalizations: [{ to: [{ email: message.to }] }],
    from: parseSender(message.from),
    subject: message.subject,
    content: [
      ...(message.text === undefined
        ? []
        : [{ type: "text/plain", value: message.text }]),
      { type: "text/html", value: message.html },
    ],
  };
}

/* "Name <a@b.co>" or "a@b.co" as SendGrid's { email, name } object. */
export function parseSender(from: string): { email: string; name?: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);

  if (match === null) {
    return { email: from.trim() };
  }

  const name = (match[1] ?? "").replace(/^"|"$/g, "");
  const email = match[2] ?? "";

  return name === "" ? { email } : { email, name };
}
