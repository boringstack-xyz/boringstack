import type {
  IRegisteredEvent,
  IRenderedNotification,
} from "../notifications.types";

/**
 * Job payload — kept structurally compatible with
 * `INotificationDispatchJobData` in `src/queues/notification-dispatch/`,
 * because both the BullMQ worker and the inline fallback path call
 * `runNotificationDispatch` with the same shape.
 */
export interface IDispatchJob {
  eventType: string;
  recipientUserId: string;
  payload: unknown;
  channelsOverride?: readonly string[];
}

export type DispatchOutcome =
  "dispatched" | "deduplicated" | "self_action_skipped" | "unknown_event";

export interface IDispatchResult {
  outcome: DispatchOutcome;
  notificationId?: string;
}

/** Input for the worker's per-event row insert. */
export interface IPersistInput {
  recipientUserId: string;
  eventType: string;
  payload: unknown;
  rendered: IRenderedNotification;
  enabledChannels: readonly string[];
  disabledChannels: readonly string[];
}

/** Input for the worker's per-channel fan-out step. */
export interface IFanOutInput {
  notificationId: string;
  recipientUserId: string;
  event: IRegisteredEvent;
  payload: unknown;
  rendered: IRenderedNotification;
  channels: readonly string[];
}
