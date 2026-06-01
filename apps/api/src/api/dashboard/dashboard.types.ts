export interface IActivityItem {
  readonly id: string;
  readonly title: string;
  readonly timestamp: string;
}

export interface IDashboardSummary {
  readonly totalEvents: number;
  readonly recentActivity: IActivityItem[];
}

export interface IActivityPage {
  readonly items: IActivityItem[];
  readonly nextCursor: string | null;
}
