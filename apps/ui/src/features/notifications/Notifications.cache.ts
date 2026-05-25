import type { QueryClient } from "@tanstack/react-query";

import { NOTIFICATIONS_QUERY_KEYS } from "./Notifications.constants";
import type { IInfiniteCache, IListSnapshots } from "./Notifications.types";

export function snapshotLists(qc: QueryClient): IListSnapshots {
  return qc.getQueriesData<IInfiniteCache>({
    queryKey: NOTIFICATIONS_QUERY_KEYS.list
  });
}

export function restoreLists(qc: QueryClient, snapshots: IListSnapshots): void {
  for (const [key, data] of snapshots) {
    qc.setQueryData(key, data);
  }
}
