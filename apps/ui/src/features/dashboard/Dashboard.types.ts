import type { z } from "zod";

import type { operations } from "@/lib/api/client";

import type { dashboardSummarySchema } from "./Dashboard.schemas";

export type IDashboardSummary = z.infer<typeof dashboardSummarySchema>;

/*
 * Elysia's swagger plugin inlines schemas rather than referencing component
 * types, so we extract the per-operation response shape instead of pulling
 * from `components["schemas"]`.
 */
type ActivityListResponse =
  operations["getApiV1DashboardActivity"]["responses"][200]["content"]["application/json"];

export type IActivityPage = ActivityListResponse;
export type IActivityItem = ActivityListResponse["items"][number];
