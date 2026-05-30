import { useTranslation } from "react-i18next";

import { useMe } from "@/features/auth/Auth.queries";

import { useAuditLog } from "../../AuditLog.queries";
import type { IAuditLogEntry } from "../../AuditLog.types";

export interface IAuditLogPageView {
  readonly pageTitle: string;
  readonly pageSubtitle: string;
  readonly systemFallback: string;
  readonly loadingLabel: string;
  readonly errorMessage: string;
  readonly emptyMessage: string;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly entries: readonly IAuditLogEntry[];
}

export function useAuditLogPage(): IAuditLogPageView {
  const { t } = useTranslation();
  const me = useMe();
  const query = useAuditLog(me.data?.account.id);

  return {
    pageTitle: t("accounts.auditLog.pageTitle"),
    pageSubtitle: t("accounts.auditLog.pageSubtitle"),
    systemFallback: t("accounts.auditLog.systemActor"),
    loadingLabel: t("accounts.auditLog.loading"),
    errorMessage: t("accounts.auditLog.error"),
    emptyMessage: t("accounts.auditLog.empty"),
    isPending: query.isPending,
    isError: query.isError,
    isSuccess: query.isSuccess,
    entries: query.data?.entries ?? []
  };
}
