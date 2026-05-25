import type { TSchema } from "@sinclair/typebox";
import type { NOTIFICATION_CHANNELS } from "./notifications.constants";

/**
 * Channel keys are kept open-typed (`string`) so fork users can register
 * their own channels (SMS, in-game, custom webhooks) without modifying the
 * framework. The built-in set is exported as `NotificationChannelName` for
 * call sites that only consume the channels this template ships.
 */
export type NotificationChannelName =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

/**
 * Pre-rendered in-app shape. Backends own the strings; the UI consumes
 * them verbatim and never needs to interpret event types. `ctaUrl` /
 * `ctaLabel` are optional because not every event has a destination.
 */
export interface IRenderedNotification {
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

export interface IEventRenderContext<TPayload> {
  recipientUserId: string;
  payload: TPayload;
}

/**
 * Per-channel email render contract, typed by the event's payload at the
 * author boundary.
 */
export interface IEmailRender<TPayload> {
  subject: (ctx: IEventRenderContext<TPayload>) => string;
  templatePath: string;
  variables?: (ctx: IEventRenderContext<TPayload>) => Record<string, unknown>;
}

export interface IDedupStrategy<TPayload> {
  key: (ctx: IEventRenderContext<TPayload>) => string;
  /** TTL of the dedup row. Subsequent identical events inside this window are dropped. */
  windowSeconds: number;
}

/**
 * Author-facing event definition. Passed to `defineNotificationEvent`,
 * which wraps it into a runtime-erased `IRegisteredEvent`.
 */
export interface INotificationEventDefinition<
  TPayload,
  TSchemaShape extends TSchema = TSchema,
> {
  /** Stable string id, e.g. `"comment.replied"`. */
  type: string;
  /** TypeBox schema validating `payload`. */
  schema: TSchemaShape;
  /** Channels to dispatch on when no user preference is set. */
  defaultChannels: readonly NotificationChannelName[];
  /** Optional dedup. Omit to dispatch every event. */
  dedup?: IDedupStrategy<TPayload>;
  /** Optional self-action guard. Returns `true` to suppress dispatch. */
  selfActionGuard?: (ctx: IEventRenderContext<TPayload>) => boolean;
  /** Per-channel render functions. */
  render: {
    inApp?: (ctx: IEventRenderContext<TPayload>) => IRenderedNotification;
    email?: IEmailRender<TPayload>;
  };
}

/**
 * Runtime-erased event shape stored in the registry. All callables take
 * `unknown` payload internally — the wrapping inside
 * `defineNotificationEvent` adapts the user's typed functions to this
 * shape via TypeBox `Value.Cast`, preserving type safety end-to-end
 * without any TS assertions.
 */
export interface IRegisteredEvent {
  readonly type: string;
  readonly schema: TSchema;
  readonly defaultChannels: readonly NotificationChannelName[];
  readonly dedup?: {
    readonly key: (ctx: IEventRenderContext<unknown>) => string;
    readonly windowSeconds: number;
  };
  readonly selfActionGuard?: (ctx: IEventRenderContext<unknown>) => boolean;
  readonly render: {
    readonly inApp?: (
      ctx: IEventRenderContext<unknown>
    ) => IRenderedNotification;
    readonly email?: {
      readonly subject: (ctx: IEventRenderContext<unknown>) => string;
      readonly templatePath: string;
      readonly variables?: (
        ctx: IEventRenderContext<unknown>
      ) => Record<string, unknown>;
    };
  };
}

/**
 * Phantom payload brand. Lets `notifications.send(event, args)` infer the
 * typed payload shape from `event` at the call site, while the underlying
 * stored object remains a runtime-erased `IRegisteredEvent`. The brand is
 * never present at runtime — it only exists in the type system.
 */
export interface IPayloadBrand<TPayload> {
  readonly __payload?: (p: TPayload) => void;
}

export type INotificationEvent<TPayload> = IRegisteredEvent &
  IPayloadBrand<TPayload>;

export interface INotificationSendInput<TPayload> {
  recipientUserId: string;
  payload: TPayload;
  /** Override the event's `defaultChannels`. Tests + admin paths only. */
  channelsOverride?: readonly NotificationChannelName[];
}

/**
 * Internal context passed to channel implementations once the worker has
 * resolved the event definition + rendered the payload. Channels write the
 * delivery row; the worker mediates the orchestration.
 */
export interface IChannelDispatchContext {
  notificationId: string;
  recipientUserId: string;
  event: IRegisteredEvent;
  payload: unknown;
  rendered: IRenderedNotification;
}

/**
 * Contract every channel implements. `name` keys the registry. `dispatch`
 * runs whatever side effect the channel needs (DB update, BullMQ enqueue,
 * Valkey publish) and is called from inside the worker's per-channel
 * `Promise.allSettled` — a thrown error is captured into the delivery row.
 */
export interface INotificationChannel {
  readonly name: NotificationChannelName;
  dispatch: (ctx: IChannelDispatchContext) => Promise<void>;
}
