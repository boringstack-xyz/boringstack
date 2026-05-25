import type { Queue } from "bullmq";
import type { NotificationMaintenanceWorker } from "./notification-maintenance.worker";

/**
 * Maintenance jobs are name-discriminated (no opaque payload) — the worker
 * branches on `job.name` to pick the right routine. Right now only
 * `dedup-cleanup` exists, but archive purges, stats rollups, etc. can land
 * in the same queue as the surface grows.
 */
export interface INotificationMaintenanceJobData {
  /** Reserved for future per-job parameters; unused today. */
  meta?: Record<string, unknown>;
}

export interface INotificationMaintenanceSetupResult {
  queue: Queue<INotificationMaintenanceJobData>;
  worker: NotificationMaintenanceWorker;
}
