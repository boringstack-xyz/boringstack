import { afterEach, describe, expect, spyOn, test } from "bun:test";

import {
  createSendGridClient,
  parseSender,
  sendGridPayload,
} from "../../../../src/lib/email/providers/sendgrid.client";

const fetchSpy = spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
});

const SENDER = "hi@example.com";
const RECIPIENT = "you@example.com";

const message = {
  from: SENDER,
  to: RECIPIENT,
  subject: "S",
  html: "<p>x</p>",
};

describe("SendGrid HTTP client", () => {
  test("parses a named and a bare sender", () => {
    expect(parseSender(`"Boring Stack" <${SENDER}>`)).toEqual({
      email: SENDER,
      name: "Boring Stack",
    });
    expect(parseSender(SENDER)).toEqual({ email: SENDER });
  });

  test("builds the v3 body with text before html", () => {
    expect(sendGridPayload({ ...message, text: "x" })).toEqual({
      personalizations: [{ to: [{ email: RECIPIENT }] }],
      from: { email: SENDER },
      subject: "S",
      content: [
        { type: "text/plain", value: "x" },
        { type: "text/html", value: "<p>x</p>" },
      ],
    });
  });

  test("posts with the API key and returns the message id header", async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 202, headers: { "x-message-id": "abc123" } })
    );

    const client = createSendGridClient();

    client.setApiKey("SG.test");

    const [response] = await client.send(message);
    const init = fetchSpy.mock.calls[0]?.[1];

    expect(response.headers).toMatchObject({ "x-message-id": "abc123" });
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer SG.test"
    );
  });

  test("rejects with SendGrid's error text so suppression is detected", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        '{"errors":[{"message":"The email address is on the bounce list"}]}',
        { status: 400 }
      )
    );

    let captured: unknown;

    try {
      await createSendGridClient().send(message);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(Error);
    expect(String(captured)).toContain("bounce list");
  });
});
