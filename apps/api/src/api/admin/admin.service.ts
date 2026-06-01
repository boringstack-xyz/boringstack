import { getQueueManager } from "../../config/setup";
import { ApiErrors } from "../../lib/errors";
import type { IQueueStats } from "../../queues";

export class AdminService {
  /**
   * Snapshot of every BullMQ queue's job counts. Returns an empty array
   * when queues are disabled — admins still get a 200 with `queues: []`
   * rather than a confusing 503, so dashboards don't have to special-case
   * the off state.
   */
  async getQueueStats(): Promise<IQueueStats[]> {
    const manager = getQueueManager();

    if (manager === null) {
      return [];
    }

    try {
      return await manager.getStats();
    } catch {
      throw ApiErrors.externalService("Failed to fetch queue statistics");
    }
  }
}

export const adminService = new AdminService();
