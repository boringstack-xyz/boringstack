import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { CloudflareEmailService } from "../../../../src/lib/email/providers/cloudflare";

const ACCOUNT_ID = "test-account-id-1234";
const API_TOKEN = "test-token-deadbeef";
const FROM = "noreply@example.com";
const TO = "user@example.com";

const successBody = (id: string): string =>
  JSON.stringify({ success: true, result: { id } });

interface IFetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

const originalFetch = globalThis.fetch;

const installFakeFetch = (response: Response): { calls: IFetchCall[] } => {
  const calls: IFetchCall[] = [];

  const fake = (
    input: URL | RequestInfo,
    init?: RequestInit
  ): Promise<Response> => {
    if (typeof input !== "string") {
      throw new Error("test fake expected a string URL");
    }

    calls.push({ url: input, init: init ?? {} });

    return Promise.resolve(response.clone());
  };

  /*
   * Bun's `typeof fetch` includes a `preconnect` static — give the fake a
   * matching no-op so the assignment satisfies the type without a cast.
   */
  const preconnect: typeof fetch.preconnect = () => undefined;

  globalThis.fetch = Object.assign(fake, { preconnect });

  return { calls };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readJsonBody = (init: RequestInit): Record<string, unknown> => {
  const body = init.body;

  if (typeof body !== "string") {
    throw new Error("test fake expected a string body");
  }

  const parsed: unknown = JSON.parse(body);

  if (!isPlainObject(parsed)) {
    throw new Error("test fake expected a JSON object body");
  }

  return parsed;
};

const isHeadersRecord = (
  header: HeadersInit | undefined
): header is Record<string, string> =>
  header !== undefined &&
  typeof header === "object" &&
  !Array.isArray(header) &&
  !(header instanceof Headers);

describe("CloudflareEmailService", () => {
  beforeEach(() => {
    process.env.EMAIL_FROM = FROM;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("POSTs to the account-scoped Email Service endpoint", async () => {
    const { calls } = installFakeFetch(
      new Response(successBody("msg_abc123"), { status: 200 })
    );

    const svc = new CloudflareEmailService(ACCOUNT_ID, API_TOKEN);

    await svc.send({ to: TO, subject: "hi", html: "<p>hi</p>" });

    expect(calls.length).toBe(1);
    expect(calls[0]?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`
    );
  });

  test("sends Bearer auth + JSON body with required fields", async () => {
    const { calls } = installFakeFetch(
      new Response(successBody("msg_abc123"), { status: 200 })
    );

    const svc = new CloudflareEmailService(ACCOUNT_ID, API_TOKEN);

    await svc.send({
      to: TO,
      subject: "subj",
      html: "<p>body</p>",
      text: "body",
    });

    const init = calls[0]?.init;

    if (!init) {
      throw new Error("expected a captured fetch call");
    }

    const headers = init.headers;

    if (!isHeadersRecord(headers)) {
      throw new Error("expected a plain-object Headers init");
    }

    expect(headers.authorization).toBe(`Bearer ${API_TOKEN}`);
    expect(headers["content-type"]).toBe("application/json");

    const body = readJsonBody(init);

    expect(body.to).toBe(TO);
    expect(body.subject).toBe("subj");
    expect(body.html).toBe("<p>body</p>");
    expect(body.text).toBe("body");
  });

  test("omits `text` from the body when not provided", async () => {
    const { calls } = installFakeFetch(
      new Response(successBody("msg_abc123"), { status: 200 })
    );

    const svc = new CloudflareEmailService(ACCOUNT_ID, API_TOKEN);

    await svc.send({ to: TO, subject: "x", html: "<p>x</p>" });

    const init = calls[0]?.init;

    if (!init) {
      throw new Error("expected a captured fetch call");
    }

    const body = readJsonBody(init);

    expect("text" in body).toBe(false);
  });

  test("returns the message id from the Cloudflare response body", async () => {
    installFakeFetch(new Response(successBody("msg_xyz"), { status: 200 }));

    const svc = new CloudflareEmailService(ACCOUNT_ID, API_TOKEN);
    const result = await svc.send({
      to: TO,
      subject: "x",
      html: "<p>x</p>",
    });

    expect(result).toEqual({ id: "msg_xyz", provider: "cloudflare" });
  });

  test("throws an externalService error on non-2xx after retries", async () => {
    installFakeFetch(new Response('{"error":"forbidden"}', { status: 403 }));

    const svc = new CloudflareEmailService(ACCOUNT_ID, API_TOKEN);
    let caught: unknown;

    try {
      await svc.send({ to: TO, subject: "x", html: "<p>x</p>" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);

    if (!(caught instanceof Error)) {
      throw new Error("unreachable");
    }

    expect(caught.message).toMatch(/Cloudflare/);
  });
});
