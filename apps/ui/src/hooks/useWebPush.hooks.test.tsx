import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/openapi", () => ({
  subscribeWebPush: vi.fn(),
  unsubscribeWebPush: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  env: {
    VITE_VAPID_PUBLIC_KEY: "",
    VITE_API_URL: ""
  }
}));

const { useWebPush } = await import("./useWebPush.hooks");

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
