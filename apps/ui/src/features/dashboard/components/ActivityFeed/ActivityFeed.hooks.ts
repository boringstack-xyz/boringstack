import { useCallback, useMemo } from "react";

import { useActivityFeed as useActivityFeedQuery } from "@/features/dashboard/Dashboard.queries";
import type { IActivityItem } from "@/features/dashboard/Dashboard.types";

import type {
  IActivityFeedProps,
  IActivityFeedView
} from "./ActivityFeed.types";

export function useActivityFeed(props: IActivityFeedProps): IActivityFeedView {
  const query = useActivityFeedQuery();

  const items: IActivityItem[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data?.pages]
  );

  const onLoadMore = useCallback((): void => {
    void query.fetchNextPage();
  }, [query]);

  return {
    className: props.className,
    items,
    isLoading: query.isPending,
    isError: query.isError,
    isEmpty: !query.isPending && items.length === 0,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    onLoadMore
  };
}
