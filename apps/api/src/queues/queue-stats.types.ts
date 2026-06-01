export interface IQueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface IQueueStats {
  name: string;
  counts: IQueueCounts;
}
