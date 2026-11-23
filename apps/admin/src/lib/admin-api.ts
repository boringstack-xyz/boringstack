import { z } from "zod";

/*
 * Sent on every request. The admin API refuses reads and writes without it,
 * and a plain cross-site page cannot add it. The name carries the project
 * token so rename-project.sh rewrites it on both sides.
 */
export const ADMIN_REQUEST_HEADER = "x-boringstack-admin";

const API_PREFIX = "/api/v1/admin";

const QueueStatsSchema = z.object({
  name: z.string(),
  counts: z.object({
    waiting: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
    delayed: z.number(),
    paused: z.number(),
  }),
});

export const QueueStatsResponseSchema = z.object({
  queues: z.array(QueueStatsSchema),
  timestamp: z.string(),
});

const AuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  resource: z.string().nullable(),
  actorUserId: z.string().nullable(),
  targetAccountId: z.string().nullable(),
  createdAt: z.string(),
});

export const AuditFeedResponseSchema = z.object({
  entries: z.array(AuditEntrySchema),
  timestamp: z.string(),
});

export type IQueueStats = z.infer<typeof QueueStatsSchema>;
export type IAuditEntry = z.infer<typeof AuditEntrySchema>;

export class AdminApiError extends Error {
  public readonly status: number;

  public constructor(status: number) {
    super(`Admin API answered ${String(status)}`);
    this.name = "AdminApiError";
    this.status = status;
  }
}

/** GET a path under the admin API and validate the body against `schema`. */
export const adminGet = async <T extends z.ZodType>(
  path: string,
  schema: T,
  query: Record<string, string> = {}
): Promise<z.infer<T>> => {
  const search = new URLSearchParams(query).toString();
  const url = `${API_PREFIX}${path}${search === "" ? "" : `?${search}`}`;

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      [ADMIN_REQUEST_HEADER]: "1",
    },
    credentials: "same-origin",
  });

  if (!res.ok) {
    throw new AdminApiError(res.status);
  }

  const body: unknown = await res.json();

  return schema.parse(body);
};
