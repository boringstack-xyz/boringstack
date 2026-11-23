import { ApiErrors } from "../../errors";

/**
 * Cloudflare Email Service's own block list ("suppressions"), read and
 * edited over its REST API with the token that sends the mail (the
 * "Email Sending: Edit" permission covers both).
 * https://developers.cloudflare.com/api/resources/email_sending/subresources/suppressions/
 */

const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
/** A runaway cursor never loops forever: 20 pages is 2,000 blocked addresses. */
const MAX_PAGES = 20;

export interface ICloudflareSuppression {
  id: string;
  email: string;
  createdAt: string;
  /** False for an entry Cloudflare manages itself, which the API refuses to delete. */
  readOnly: boolean;
}

interface ISuppressionPage {
  entries: ICloudflareSuppression[];
  nextCursor: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toEntry = (raw: unknown): ICloudflareSuppression | null => {
  if (
    !isRecord(raw) ||
    typeof raw.id !== "string" ||
    typeof raw.email !== "string" ||
    typeof raw.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    email: raw.email,
    createdAt: raw.created_at,
    /* Anything but an explicit `false` is treated as not ours to delete. */
    readOnly: raw.read_only !== false,
  };
};

/** One page of the list response; entries missing a field are dropped. */
export const parseSuppressionPage = (body: unknown): ISuppressionPage => {
  if (!isRecord(body) || !Array.isArray(body.result)) {
    return { entries: [], nextCursor: null };
  }

  const info = body.result_info;
  const cursor = isRecord(info) ? info.next_cursor : null;

  return {
    entries: body.result
      .map(toEntry)
      .filter((entry): entry is ICloudflareSuppression => entry !== null),
    nextCursor: typeof cursor === "string" && cursor !== "" ? cursor : null,
  };
};

export class CloudflareSuppressionsClient {
  private readonly endpoint: string;
  private readonly apiToken: string;

  constructor(accountId: string, apiToken: string) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/suppressions`;
    this.apiToken = apiToken;
  }

  /** Every address Cloudflare is holding back after a soft bounce. */
  async listSoftBounces(): Promise<ICloudflareSuppression[]> {
    const entries: ICloudflareSuppression[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({
        reason: "soft_bounce",
        per_page: String(PAGE_SIZE),
        ...(cursor === null ? {} : { cursor }),
      });
      const response = await this.request(
        `${this.endpoint}?${query.toString()}`,
        "GET"
      );
      const parsed = parseSuppressionPage(await response.json());

      entries.push(...parsed.entries);
      cursor = parsed.nextCursor;

      if (cursor === null) {
        break;
      }
    }

    return entries;
  }

  /** Lifts one block, so the next send to that address is attempted. */
  async remove(id: string): Promise<void> {
    await this.request(`${this.endpoint}/${encodeURIComponent(id)}`, "DELETE");
  }

  private async request(
    url: string,
    method: "GET" | "DELETE"
  ): Promise<Response> {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { authorization: `Bearer ${this.apiToken}` },
    });

    if (!response.ok) {
      throw ApiErrors.externalService(
        `Cloudflare suppressions ${method} HTTP ${String(response.status)}`
      );
    }

    return response;
  }
}
