import type { IDashboardSummary } from "@/features/dashboard/Dashboard.types";

/**
 * Build a valid `IDashboardSummary` for tests and Storybook decorators.
 */
export function makeDashboardSummary(
  overrides: Partial<IDashboardSummary> = {}
): IDashboardSummary {
  return {
    totalEvents: 47,
    recentActivity: [
      {
        id: "1",
        title: "User signed up",
        timestamp: "2026-05-11T09:30:00.000Z"
      }
    ],
    ...overrides
  };
}
