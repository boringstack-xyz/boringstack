import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useMfaDisable,
  useMfaRegenerateRecoveryCodes,
  useMfaSetup,
  useMfaVerifySetup
} from "./Auth.mfa.management.mutations";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({ apiClient: apiMock }));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { Wrapper, client };
}

beforeEach(() => {
  apiMock.POST.mockReset();
});

describe("useMfaSetup", () => {
  it("POSTs to /auth/mfa/setup and returns the staged secret", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          otpauthUri: "otpauth://totp/x:a@b.c?secret=ABC",
          secretBase32: "ABC",
          recoveryCodes: ["1", "2"]
        }
      }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaSetup(), { wrapper: Wrapper });

    let response: { secretBase32: string } | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({ password: "Hunter2!" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/mfa/setup", {
      body: { password: "Hunter2!" }
    });
    expect(response?.secretBase32).toBe("ABC");
  });
});

describe("useMfaVerifySetup", () => {
  it("POSTs the first code", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { message: "MFA enabled" } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaVerifySetup(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({ code: "123456" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/mfa/verify-setup", {
      body: { code: "123456" }
    });
  });
});

describe("useMfaDisable", () => {
  it("POSTs to /auth/mfa/disable", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { message: "MFA disabled" } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaDisable(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ password: "Hunter2!" });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/mfa/disable", {
      body: { password: "Hunter2!" }
    });
  });
});

describe("useMfaRegenerateRecoveryCodes", () => {
  it("returns fresh recovery codes", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { recoveryCodes: ["1", "2", "3"] } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMfaRegenerateRecoveryCodes(), {
      wrapper: Wrapper
    });

    let response: { recoveryCodes: string[] } | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({ password: "Hunter2!" });
    });

    expect(response?.recoveryCodes).toEqual(["1", "2", "3"]);
  });
});
