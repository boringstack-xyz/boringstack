import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeWebPush, unsubscribeWebPush } from "@/lib/api/openapi";

vi.mock("@/lib/api/openapi", () => ({
  subscribeWebPush: vi.fn(),
  unsubscribeWebPush: vi.fn()
}));

/*
 * The hook reads `env.VITE_VAPID_PUBLIC_KEY` on every render to decide
 * `isConfigured`. Hoist a mutable env object so individual tests can toggle
 * between "not configured" (guard tests) and "configured" (subscribe tests).
 */
const hoisted = vi.hoisted(() => ({
  env: { VITE_VAPID_PUBLIC_KEY: "", VITE_API_URL: "" }
}));

vi.mock("@/lib/env", () => ({ env: hoisted.env }));

const { useWebPush } = await import("./useWebPush.hooks");

/*
 * A short, obviously-fake base64url value — the hook only `atob`-decodes the
 * key (no crypto validation), so this is all the subscribe path needs.
 */
const STUB_VAPID = "dGVzdA";

interface ISubscriptionMock {
  endpoint: string;
  expirationTime: number | null;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
}

function makeSubscription(endpoint: string): ISubscriptionMock {
  return {
    endpoint,
    expirationTime: null,
    toJSON: () => ({
      endpoint,
      keys: { p256dh: "p256dh-key", auth: "auth-key" }
    }),
    unsubscribe: vi.fn().mockResolvedValue(true)
  };
}

interface ISetupOptions {
  permission?: NotificationPermission;
  requestResult?: NotificationPermission;
  existingSubscription?: ISubscriptionMock | null;
}

interface ISetupHandles {
  requestPermission: ReturnType<typeof vi.fn>;
  getSubscription: ReturnType<typeof vi.fn>;
  pushSubscribe: ReturnType<typeof vi.fn>;
}

function setupSupportedBrowser(options: ISetupOptions = {}): ISetupHandles {
  const permission = options.permission ?? "default";
  const requestResult = options.requestResult ?? "granted";
  const existingSubscription = options.existingSubscription ?? null;

  const requestPermission = vi.fn().mockResolvedValue(requestResult);
  const getSubscription = vi.fn().mockResolvedValue(existingSubscription);
  const pushSubscribe = vi
    .fn()
    .mockResolvedValue(makeSubscription("https://push.example/new"));

  vi.stubGlobal("Notification", { permission, requestPermission });
  // The hook only probes `"PushManager" in window`; a marker object suffices.
  vi.stubGlobal("PushManager", { name: "PushManager" });

  const registration = {
    pushManager: { getSubscription, subscribe: pushSubscribe }
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) }
  });

  hoisted.env.VITE_VAPID_PUBLIC_KEY = STUB_VAPID;

  return { requestPermission, getSubscription, pushSubscribe };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  hoisted.env.VITE_VAPID_PUBLIC_KEY = "";
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("useWebPush — environment guards", () => {
  it("reports isSupported=false outside a Web Push capable browser", () => {
    const { result } = renderHook(() => useWebPush());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.permission).toBe("default");
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("exposes subscribe / unsubscribe as no-op promises when unsupported", async () => {
    const { result } = renderHook(() => useWebPush());

    await expect(result.current.subscribe()).resolves.toBeUndefined();
    await expect(result.current.unsubscribe()).resolves.toBeUndefined();
  });
});

describe("useWebPush — supported browser", () => {
  beforeEach(() => {
    hoisted.env.VITE_VAPID_PUBLIC_KEY = "";
  });

  it("detects an already-active subscription on mount", async () => {
    setupSupportedBrowser({
      existingSubscription: makeSubscription("https://push.example/existing")
    });

    const { result } = renderHook(() => useWebPush());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isConfigured).toBe(true);
    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  it("requests permission, subscribes, and posts the subscription", async () => {
    const handles = setupSupportedBrowser({ requestResult: "granted" });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(handles.requestPermission).toHaveBeenCalledOnce();
    expect(handles.pushSubscribe).toHaveBeenCalledOnce();
    expect(vi.mocked(subscribeWebPush)).toHaveBeenCalledOnce();
    expect(result.current.permission).toBe("granted");
    expect(result.current.isSubscribed).toBe(true);
  });

  it("reuses an existing subscription instead of creating a new one", async () => {
    const handles = setupSupportedBrowser({
      requestResult: "granted",
      existingSubscription: makeSubscription("https://push.example/existing")
    });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(handles.pushSubscribe).not.toHaveBeenCalled();
    expect(vi.mocked(subscribeWebPush)).toHaveBeenCalledOnce();
    expect(result.current.isSubscribed).toBe(true);
  });

  it("stops and records denied permission without posting", async () => {
    const handles = setupSupportedBrowser({ requestResult: "denied" });

    const { result } = renderHook(() => useWebPush());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(handles.pushSubscribe).not.toHaveBeenCalled();
    expect(vi.mocked(subscribeWebPush)).not.toHaveBeenCalled();
    expect(result.current.permission).toBe("denied");
    expect(result.current.isSubscribed).toBe(false);
  });

  it("unsubscribes from the browser and the server", async () => {
    const subscription = makeSubscription("https://push.example/active");

    setupSupportedBrowser({ existingSubscription: subscription });

    const { result } = renderHook(() => useWebPush());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.mocked(unsubscribeWebPush)).toHaveBeenCalledWith(
      "https://push.example/active"
    );
    expect(result.current.isSubscribed).toBe(false);
  });

  it("stays unsubscribed even if the server DELETE fails", async () => {
    const subscription = makeSubscription("https://push.example/active");

    setupSupportedBrowser({ existingSubscription: subscription });
    vi.mocked(unsubscribeWebPush).mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useWebPush());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(result.current.isSubscribed).toBe(false);
  });
});
