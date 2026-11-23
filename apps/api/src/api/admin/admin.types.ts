import type { IQueueStats } from "../../queues";

export type QueueStatsReader = () => Promise<IQueueStats[]>;
