import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUser } from "../../../tests/factories";
import { AUTH_QUERY_KEYS } from "./Auth.constants";
import { useUpdateProfile } from "./Auth.profile.mutations";

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

  return { client, Wrapper };
}

beforeEach(() => {
  apiMock.PATCH.mockReset();
});

describe("useUpdateProfile", () => {
  it("PATCHes /api/v1/users/me and invalidates the me query", async () => {
    const user = makeUser({ firstName: "Grace", lastName: "Hopper" });

    apiMock.PATCH.mockResolvedValueOnce({ data: user });

    const { client, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current.mutateAsync({
        firstName: "Grace",
        lastName: "Hopper"
      });
    });

    expect(apiMock.PATCH).toHaveBeenCalledWith("/api/v1/users/me", {
      body: { firstName: "Grace", lastName: "Hopper" }
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: AUTH_QUERY_KEYS.me
    });
  });

  it("throws when the server returns no profile body", async () => {
    apiMock.PATCH.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: Wrapper
    });

    await act(async () => {
      await result.current
        .mutateAsync({ firstName: "A", lastName: "B" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
