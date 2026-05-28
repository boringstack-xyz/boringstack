import { render, screen } from "@testing-library/react";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { MfaSection } from "./MfaSection";

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

interface IStatusReturn {
  data: { enabled: boolean } | undefined;
  isLoading: boolean;
}

const mfaStatusMock = vi.fn<() => IStatusReturn>();
const setupMock = vi.fn();

vi.mock("@/features/auth/Auth.queries", () => ({
  useMfaStatus: () => mfaStatusMock()
}));

vi.mock("@/features/auth/Auth.mfa.management.mutations", () => ({
  useMfaSetup: () => ({ mutate: setupMock, isPending: false }),
  useMfaVerifySetup: () => ({ mutate: vi.fn(), isPending: false }),
  useMfaDisable: () => ({ mutate: vi.fn(), isPending: false }),
  useMfaRegenerateRecoveryCodes: () => ({ mutate: vi.fn(), isPending: false })
}));

describe("MfaSection", () => {
  it("renders the enable CTA when MFA is disabled", () => {
    mfaStatusMock.mockReturnValue({
      data: { enabled: false },
      isLoading: false
    });

    render(<MfaSection />);

    expect(
      screen.getByText("accounts.settings.mfa.enable")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("accounts.settings.mfa.passwordLabel")
    ).toBeInTheDocument();
  });

  it("renders the enabled state when MFA is on", () => {
    mfaStatusMock.mockReturnValue({
      data: { enabled: true },
      isLoading: false
    });

    render(<MfaSection />);

    expect(
      screen.getByText("accounts.settings.mfa.statusActive")
    ).toBeInTheDocument();
    expect(
      screen.getByText("accounts.settings.mfa.disable")
    ).toBeInTheDocument();
  });

  it("renders the loading state while status is fetching", () => {
    mfaStatusMock.mockReturnValue({ data: undefined, isLoading: true });

    render(<MfaSection />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });
});
