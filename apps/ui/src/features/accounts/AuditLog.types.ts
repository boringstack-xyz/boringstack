import type { paths } from "@/lib/api/schema";

export type IAuditLogListResponse =
  paths["/api/v1/accounts/{id}/audit-log"]["get"]["responses"][200]["content"]["application/json"];

export type IAuditLogEntry = IAuditLogListResponse["entries"][number];
