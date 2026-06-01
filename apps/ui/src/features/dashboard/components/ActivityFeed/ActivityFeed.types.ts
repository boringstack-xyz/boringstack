import type { IActivityItem } from "@/features/dashboard/Dashboard.types";

export interface IActivityFeedProps {
  readonly className?: string;
}

export interface IActivityFeedView {
  readonly className: string | undefined;
  readonly items: readonly IActivityItem[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isEmpty: boolean;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly onLoadMore: () => void;
}
