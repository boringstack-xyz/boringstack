import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuditLogPage } from "./AuditLogPage.hooks";

const useMeMock = vi.hoisted(() => vi.fn());
const useAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/Auth.queries", () => ({
  useMe: useMeMock
}));

vi.mock("../../AuditLog.queries", () => ({
  useAuditLog: useAuditLogMock
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" }
  })
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useMeMock.mockReset();
  useAuditLogMock.mockReset();
});

describe("useAuditLogPage", () => {
  it("maps the success state of useAuditLog into the view shape", () => {
    useMeMock.mockReturnValue({
      data: { account: { id: "acc-1", name: "Acc" } }
    });
    useAuditLogMock.mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: { entries: [{ id: "e1", action: "auth.login_success" }] }
    });

    const Wrapper = wrapper();
    const { result } = renderHook(() => useAuditLogPage(), {
      wrapper: Wrapper
    });

    expect(result.current.pageTitle).toBe("accounts.auditLog.pageTitle");
    expect(result.current.entries).toEqual([
      { id: "e1", action: "auth.login_success" }
    ]);
    expect(result.current.isSuccess).toBe(true);
  });

  it("passes the active account id from useMe to useAuditLog", () => {
    useMeMock.mockReturnValue({
      data: { account: { id: "acc-7", name: "Acc" } }
    });
    useAuditLogMock.mockReturnValue({
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined
    });

    const Wrapper = wrapper();

    renderHook(() => useAuditLogPage(), { wrapper: Wrapper });

    expect(useAuditLogMock).toHaveBeenCalledWith("acc-7");
  });

  it("returns an empty entry list when the query is pending", () => {
    useMeMock.mockReturnValue({ data: undefined });
    useAuditLogMock.mockReturnValue({
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined
    });

    const Wrapper = wrapper();
    const { result } = renderHook(() => useAuditLogPage(), {
      wrapper: Wrapper
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.isPending).toBe(true);
  });
});
