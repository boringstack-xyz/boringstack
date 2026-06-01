export type IWebPushPermission = "default" | "granted" | "denied";

export interface IUseWebPushView {
  /**
   * True when the browser exposes both the Notification API and the
   * Push API + ServiceWorker registration shape we need. Safari before
   * 16 reports `false`.
   */
  readonly isSupported: boolean;
  /**
   * True only when the operator has wired a VAPID public key into the
   * UI env. Without it, the subscribe call can never succeed because the
   * browser refuses to call `pushManager.subscribe()` with an empty key.
   */
  readonly isConfigured: boolean;
  readonly permission: IWebPushPermission;
  readonly isSubscribed: boolean;
  readonly isPending: boolean;
  readonly subscribe: () => Promise<void>;
  readonly unsubscribe: () => Promise<void>;
}
