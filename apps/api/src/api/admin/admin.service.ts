import { ApiErrors } from "../../lib/errors";
import { getQueueStatsReadOnly } from "../../queues/queue-stats.readonly";
import type { IQueueStats } from "../../queues";

import type { QueueStatsReader } from "./admin.types";

export class AdminService {
  constructor(
    private readonly readQueueStats: QueueStatsReader = getQueueStatsReadOnly
  ) {}

  /**
   * Snapshot of every BullMQ queue's job counts, read through plain Queue
   * handles so the admin process never runs a worker or a scheduler.
   */
  async getQueueStats(): Promise<IQueueStats[]> {
    try {
      return await this.readQueueStats();
    } catch {
      throw ApiErrors.externalService("Failed to fetch queue statistics");
    }
  }
}

export const adminService = new AdminService();
