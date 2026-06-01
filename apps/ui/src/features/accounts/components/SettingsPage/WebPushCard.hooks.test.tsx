import { renderHook } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebPushCard } from "./WebPushCard.hooks";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof ReactI18Next>("react-i18next");

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en" }
    })
  };
});

const baseHookReturn = {
  isSupported: true,
  isConfigured: true,
  permission: "default" as const,
  isSubscribed: false,
  isPending: false,
  subscribe: () => Promise.resolve(),
  unsubscribe: () => Promise.resolve()
};

const useWebPushMock = vi.hoisted(() => vi.fn());
const useCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWebPush.hooks", () => ({
  useWebPush: useWebPushMock
}));

vi.mock("@/lib/api/queries/useCapabilities", () => ({
  useCapabilities: useCapabilitiesMock
}));

const defaultCapabilities = {
  data: {
    features: {
      notifications: { webPush: true, sse: false },
      billing: { enabled: false },
      ai: { enabled: false }
    },
    oauth: { providers: [] }
  }
};

beforeEach(() => {
  useCapabilitiesMock.mockReturnValue(defaultCapabilities);
});

describe("useWebPushCard — view-state mapping", () => {
  it("returns the unsupported label when the browser doesn't support Web Push", () => {
    useWebPushMock.mockReturnValue({ ...baseHookReturn, isSupported: false });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateUnsupported"
    );
    expect(result.current.canAct).toBe(false);
  });

  it("returns the not-configured label when the operator hasn't set VAPID", () => {
    useWebPushMock.mockReturnValue({ ...baseHookReturn, isConfigured: false });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateNotConfigured"
    );
    expect(result.current.canAct).toBe(false);
  });

  it("returns the not-configured label when the API has Web Push disabled", () => {
    useCapabilitiesMock.mockReturnValue({
      data: {
        features: {
          notifications: { webPush: false, sse: false },
          billing: { enabled: false },
          ai: { enabled: false }
        },
        oauth: { providers: [] }
      }
    });
    useWebPushMock.mockReturnValue({ ...baseHookReturn, isConfigured: true });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateNotConfigured"
    );
    expect(result.current.canAct).toBe(false);
  });

  it("returns the blocked label when the browser denied permission", () => {
    useWebPushMock.mockReturnValue({
      ...baseHookReturn,
      permission: "denied"
    });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateBlocked"
    );
    expect(result.current.canAct).toBe(false);
  });

  it("offers the subscribe action when ready but not subscribed", () => {
    useWebPushMock.mockReturnValue({
      ...baseHookReturn,
      permission: "default",
      isSubscribed: false
    });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateNotSubscribed"
    );
    expect(result.current.buttonLabel).toBe(
      "accounts.settings.sections.webPush.subscribe"
    );
    expect(result.current.canAct).toBe(true);
  });

  it("offers the unsubscribe action when already subscribed", () => {
    useWebPushMock.mockReturnValue({
      ...baseHookReturn,
      isSubscribed: true,
      permission: "granted"
    });

    const { result } = renderHook(() => useWebPushCard());

    expect(result.current.stateLabel).toBe(
      "accounts.settings.sections.webPush.stateSubscribed"
    );
    expect(result.current.buttonLabel).toBe(
      "accounts.settings.sections.webPush.unsubscribe"
    );
    expect(result.current.canAct).toBe(true);
  });
});
