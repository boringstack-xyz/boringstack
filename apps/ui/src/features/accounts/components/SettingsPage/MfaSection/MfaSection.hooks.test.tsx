import type { BaseSyntheticEvent, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMfaSection } from "./MfaSection.hooks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } })
}));

interface IStatusReturn {
  data: { enabled: boolean } | undefined;
  isLoading: boolean;
}

const statusMock = vi.fn<() => IStatusReturn>();

/*
 * Synthetic event stub used to drive the form-submit handlers in tests.
 * Typed as the real React event so no `as` cast is needed; the handlers
 * only call `preventDefault`, so the other fields can be inert.
 */
const syntheticSubmitEvent: BaseSyntheticEvent = {
  preventDefault: () => undefined,
  stopPropagation: () => undefined,
  bubbles: false,
  cancelable: false,
  currentTarget: null,
  defaultPrevented: false,
  eventPhase: 0,
  isTrusted: false,
  nativeEvent: new Event("submit"),
  target: null,
  timeStamp: 0,
  type: "submit",
  isDefaultPrevented: () => false,
  isPropagationStopped: () => false,
  persist: () => undefined
};

vi.mock("@/features/auth/Auth.queries", () => ({
  useMfaStatus: () => statusMock()
}));

const setupMutate = vi.fn();
const verifySetupMutate = vi.fn();
const disableMutate = vi.fn();
const regenerateMutate = vi.fn();

vi.mock("@/features/auth/Auth.mfa.management.mutations", () => ({
  useMfaSetup: () => ({ mutate: setupMutate, isPending: false }),
  useMfaVerifySetup: () => ({ mutate: verifySetupMutate, isPending: false }),
  useMfaDisable: () => ({ mutate: disableMutate, isPending: false }),
  useMfaRegenerateRecoveryCodes: () => ({
    mutate: regenerateMutate,
    isPending: false
  })
}));

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMfaSection", () => {
  it("starts in the disabled state when status returns enabled=false", () => {
    statusMock.mockReturnValue({
      data: { enabled: false },
      isLoading: false
    });

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    expect(result.current.state.kind).toBe("disabled");
    expect(result.current.enrollPassword).toBe("");
    expect(result.current.verifyCode).toBe("");
  });

  it("reports the loading state while status is pending", () => {
    statusMock.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    expect(result.current.state.kind).toBe("loading");
  });

  it("reports the enabled state when status.enabled === true", () => {
    statusMock.mockReturnValue({ data: { enabled: true }, isLoading: false });

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    expect(result.current.state.kind).toBe("enabled");
  });

  it("blocks enrollment with an empty password and surfaces an error", () => {
    statusMock.mockReturnValue({
      data: { enabled: false },
      isLoading: false
    });
    setupMutate.mockClear();

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    act(() => {
      result.current.handleStartEnrollmentSubmit(syntheticSubmitEvent);
    });

    expect(setupMutate).not.toHaveBeenCalled();
    expect(result.current.enrollError).toBe(
      "accounts.settings.mfa.errors.passwordRequired"
    );
  });

  it("blocks disable with an empty password", () => {
    statusMock.mockReturnValue({ data: { enabled: true }, isLoading: false });
    disableMutate.mockClear();

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    act(() => {
      result.current.handleDisableSubmit(syntheticSubmitEvent);
    });

    expect(disableMutate).not.toHaveBeenCalled();
    expect(result.current.disableError).toBe(
      "accounts.settings.mfa.errors.passwordRequired"
    );
  });

  it("blocks regenerate with an empty password", () => {
    statusMock.mockReturnValue({ data: { enabled: true }, isLoading: false });
    regenerateMutate.mockClear();

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    act(() => {
      result.current.handleRegenerateSubmit(syntheticSubmitEvent);
    });

    expect(regenerateMutate).not.toHaveBeenCalled();
    expect(result.current.regenerateError).toBe(
      "accounts.settings.mfa.errors.passwordRequired"
    );
  });

  it("blocks verifyEnrollment when no setup is pending", () => {
    statusMock.mockReturnValue({
      data: { enabled: false },
      isLoading: false
    });
    verifySetupMutate.mockClear();

    const { result } = renderHook(() => useMfaSection(), {
      wrapper: buildWrapper()
    });

    act(() => {
      result.current.handleVerifyEnrollmentSubmit(syntheticSubmitEvent);
    });

    expect(verifySetupMutate).not.toHaveBeenCalled();
  });
});
