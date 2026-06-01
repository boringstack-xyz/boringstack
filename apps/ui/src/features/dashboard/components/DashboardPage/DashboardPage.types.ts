import type { IDashboardSummary } from "@/features/dashboard/Dashboard.types";

export interface IDashboardPageView {
  readonly summary: IDashboardSummary | undefined;
  readonly isLoading: boolean;
  readonly displayName: string;
}
