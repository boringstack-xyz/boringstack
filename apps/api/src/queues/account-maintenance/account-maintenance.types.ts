import type { Queue } from "bullmq";
import type { AccountMaintenanceWorker } from "./account-maintenance.worker";

/**
 * Account maintenance jobs are name-discriminated and need no payload today.
 * The optional `meta` slot leaves room for future dry-run or bounded-batch
 * parameters without changing the queue contract.
 */
export interface IAccountMaintenanceJobData {
  meta?: Record<string, unknown>;
}

export interface IAccountMaintenanceSweepResult {
  expiredFeatureOverrides: number;
  expiredAdminPlans: number;
  downgradedCanceledStripePlans: number;
  hardDeletedAccounts: number;
  cleanedPendingUsers: number;
  cleanedInvitations: number;
}

export interface IAccountMaintenanceSetupResult {
  queue: Queue<IAccountMaintenanceJobData>;
  worker: AccountMaintenanceWorker;
}
