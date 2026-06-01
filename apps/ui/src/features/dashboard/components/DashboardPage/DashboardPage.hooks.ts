import { useMe } from "@/features/auth/Auth.queries";
import { useDashboardSummary } from "@/features/dashboard/Dashboard.queries";

import type { IDashboardPageView } from "./DashboardPage.types";

export function useDashboardPage(): IDashboardPageView {
  const summary = useDashboardSummary();
  const me = useMe();
  const firstName = me.data?.user.firstName.trim() ?? "";
  const lastName = me.data?.user.lastName.trim() ?? "";
  const displayName = `${firstName} ${lastName}`.trim();

  return {
    summary: summary.data,
    isLoading: summary.isPending,
    displayName
  };
}
