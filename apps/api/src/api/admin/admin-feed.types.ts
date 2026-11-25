import type { IQueueStats } from "../../queues";

export interface IFeedItemDraft {
  key: string;
  title: string;
  count: number;
}

export type IAdminFeedItem = IFeedItemDraft;

export interface IAdminFeedItemState {
  state: string;
  observedCount: number;
  snoozedUntil: string | null;
}

export type IQueueStatsReader = () => Promise<IQueueStats[]>;
