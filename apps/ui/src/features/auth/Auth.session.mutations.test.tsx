import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLogin, useLogout } from "./Auth.session.mutations";

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

describe("useLogin", () => {
  it("POSTs credentials and resolves with the user payload from data.data", async () => {
    const user = { id: "u1", email: "x@example.com" };

    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { user } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    let response:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({
        email: "x@example.com",
        password: "Hunter2!"
      });
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/login", {
      body: { email: "x@example.com", password: "Hunter2!" }
    });
    expect(response?.kind).toBe("session");

    if (response?.kind === "session") {
      expect(response.user).toEqual(user);
    }
  });

  it("POSTs credentials and invalidates me + capabilities on success", async () => {
    const user = { id: "u1", email: "x@example.com" };

    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { user } }
    });

    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "x@example.com",
        password: "Hunter2!"
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["capabilities"]
    });
  });

  it("throws when the server returns no data envelope", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ email: "x@example.com", password: "p" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("resolves with an mfa-required envelope when the user has TOTP enabled", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          mfaRequired: true,
          challengeToken: "tokenxxxxxxxxxxxx"
        }
      }
    });

    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    let response:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;

    await act(async () => {
      response = await result.current.mutateAsync({
        email: "x@example.com",
        password: "Hunter2!"
      });
    });

    expect(response?.kind).toBe("mfa-required");

    if (response?.kind === "mfa-required") {
      expect(response.challengeToken).toBe("tokenxxxxxxxxxxxx");
    }

    /*
     * The /me cache must NOT be invalidated on the mfa-required branch
     * because cookies haven't been issued yet.
     */
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("throws when the envelope is neither user nor mfa-required", async () => {
    apiMock.POST.mockResolvedValueOnce({
      data: { success: true, data: { somethingElse: true } }
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ email: "x@example.com", password: "p" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useLogout", () => {
  it("POSTs /api/v1/auth/logout and clears the query cache", async () => {
    apiMock.POST.mockResolvedValueOnce({ data: { success: true } });

    const { Wrapper, client } = makeWrapper();

    client.setQueryData(["unrelated"], "still here");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(apiMock.POST).toHaveBeenCalledWith("/api/v1/auth/logout");
    expect(client.getQueryData(["unrelated"])).toBeUndefined();
  });
});
