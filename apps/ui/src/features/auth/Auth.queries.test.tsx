import {
  QueryClient,
  QueryClientProvider,
  type UseMutationResult
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { makeUser } from "../../../tests/factories";
import { useMe, useMfaStatus } from "./Auth.queries";
import { useLogin, useLogout } from "./Auth.session.mutations";
import type { ILoginInput } from "./Auth.types";

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMock
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const USER = makeUser({ firstName: "Demo", lastName: "User" });

const VALID_LOGIN: ILoginInput = {
  email: "demo@example.com",
  password: "password123"
};

beforeEach(() => {
  apiMock.GET.mockReset();
  apiMock.POST.mockReset();
});

describe("useMe", () => {
  it("returns null when the API responds 401 (the queryFn swallows it)", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" })
    );
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("returns the user when the API responds 200", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: USER, response: {} });
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(USER);
  });

  it("returns null when the response data is absent", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: undefined, response: {} });
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("propagates 5xx server errors instead of silently logging the user out", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(500, { message: "Server error" })
    );
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("returns null for network errors (treats as unauthenticated)", async () => {
    apiMock.GET.mockRejectedValueOnce(new Error("network is down"));
    const { result } = renderHook(() => useMe(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });
});

describe("useLogin", () => {
  it("returns user data on a 200 response", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: { user: USER },
        timestamp: "2026-01-01T00:00:00Z"
      },
      response: {}
    });
    const { result } = renderHook(
      () => useLogin() as UseMutationResult<unknown, unknown, ILoginInput>,
      { wrapper: wrapper() }
    );

    result.current.mutate(VALID_LOGIN);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("surfaces 401 as a mutation error", async () => {
    apiMock.POST.mockRejectedValueOnce(
      new ApiError(401, { message: "Bad creds" })
    );
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });

    result.current.mutate({ email: "wrong@x.com", password: "wrongpassword" });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("throws on an empty response body (defensive guard)", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: undefined, response: {} });
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });

    result.current.mutate(VALID_LOGIN);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useLogout", () => {
  it("succeeds on 204", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: undefined, response: {} });
    const { result } = renderHook(() => useLogout(), { wrapper: wrapper() });

    result.current.mutate(undefined);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

describe("useMfaStatus", () => {
  beforeEach(() => {
    apiMock.GET.mockReset();
  });

  it("returns the status payload from data.data", async () => {
    apiMock.GET.mockResolvedValueOnce({ data: { data: { enabled: true } } });

    const { result } = renderHook(() => useMfaStatus(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data).toEqual({ enabled: true });
    });
  });

  it("returns null when the API rejects with 401", async () => {
    apiMock.GET.mockRejectedValueOnce(
      new ApiError(401, { message: "Unauthorized" })
    );

    const { result } = renderHook(() => useMfaStatus(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it("returns null on a thrown non-ApiError", async () => {
    apiMock.GET.mockRejectedValueOnce(new Error("network blip"));

    const { result } = renderHook(() => useMfaStatus(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });
});
