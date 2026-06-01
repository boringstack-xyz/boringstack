import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import MfaChallengeForm from "./MfaChallengeForm";

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

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof MfaChallengeForm>> = {}
): React.ComponentProps<typeof MfaChallengeForm> => ({
  mode: "totp",
  code: "",
  error: null,
  isSubmitting: false,
  onCodeChange: vi.fn(),
  onSubmit: vi.fn(),
  onModeToggle: vi.fn(),
  ...overrides
});

describe("MfaChallengeForm", () => {
  it("invokes onSubmit when the form is submitted", async () => {
    const onSubmit = vi.fn();

    render(<MfaChallengeForm {...buildProps({ code: "123456", onSubmit })} />);

    await userEvent.click(screen.getByTestId("mfa-login-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders the recovery hint when in recovery mode", () => {
    render(<MfaChallengeForm {...buildProps({ mode: "recovery" })} />);

    expect(screen.getByText("auth.login.mfa.recoveryHint")).toBeInTheDocument();
  });

  it("disables the submit button when code is empty", () => {
    render(<MfaChallengeForm {...buildProps({ code: "" })} />);

    expect(screen.getByTestId("mfa-login-submit")).toBeDisabled();
  });

  it("shows the error message when set", () => {
    render(<MfaChallengeForm {...buildProps({ error: "Bad code" })} />);

    expect(screen.getByText("Bad code")).toBeInTheDocument();
  });

  it("forwards typed input to onCodeChange", async () => {
    const onCodeChange = vi.fn();

    render(<MfaChallengeForm {...buildProps({ onCodeChange })} />);

    await userEvent.type(screen.getByTestId("mfa-login-code"), "1");

    expect(onCodeChange).toHaveBeenCalledWith("1");
  });

  it("calls onModeToggle when the toggle button is pressed", async () => {
    const onModeToggle = vi.fn();

    render(<MfaChallengeForm {...buildProps({ onModeToggle })} />);

    await userEvent.click(
      screen.getByRole("button", { name: /useRecovery|recovery/i })
    );

    expect(onModeToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the recovery placeholder when in recovery mode", () => {
    render(<MfaChallengeForm {...buildProps({ mode: "recovery" })} />);

    expect(
      screen.getByLabelText("auth.login.mfa.recoveryLabel")
    ).toBeInTheDocument();
  });

  it("disables submit while isSubmitting", () => {
    render(
      <MfaChallengeForm
        {...buildProps({ code: "123456", isSubmitting: true })}
      />
    );

    expect(screen.getByTestId("mfa-login-submit")).toBeDisabled();
  });
});
