import { z } from "zod";

import { ADMIN_REQUEST_HEADER, AdminApiError } from "./admin-api";

const API_PREFIX = "/api/v1/admin";

/*
 * A JSON write to the admin API. The admin API refuses a write unless it has
 * the dashboard header and a JSON body, so the body is always sent, even when
 * empty.
 */
export const adminPost = async <T extends z.ZodType>(
  path: string,
  schema: T,
  body: Record<string, unknown> = {}
): Promise<z.infer<T>> => {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      [ADMIN_REQUEST_HEADER]: "1",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new AdminApiError(res.status);
  }

  const parsed: unknown = await res.json();

  return schema.parse(parsed);
};
