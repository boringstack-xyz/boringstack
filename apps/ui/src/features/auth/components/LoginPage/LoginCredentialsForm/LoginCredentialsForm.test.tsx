import { MemoryRouter } from "react-router-dom";

import { render, renderHook, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type * as ReactI18Next from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { LoginCredentialsForm } from "./LoginCredentialsForm";

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

describe("LoginCredentialsForm", () => {
  it("renders email + password inputs and the submit button", () => {
    const { result } = renderHook(() =>
      useForm<{ email: string; password: string }>({
        defaultValues: { email: "", password: "" }
      })
    );

    render(
      <MemoryRouter>
        <LoginCredentialsForm
          register={result.current.register}
          errors={result.current.formState.errors}
          isSubmitting={false}
          submit={vi.fn()}
          oauthProviders={[]}
          oauthButtons={[]}
          oauthPending={null}
          pendingEmail={null}
          onResendVerification={vi.fn()}
          isResending={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("auth.login.email")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.login.password")).toBeInTheDocument();
    expect(screen.getByText("auth.login.submit")).toBeInTheDocument();
  });

  it("shows the resend block when pendingEmail is set", () => {
    const { result } = renderHook(() =>
      useForm<{ email: string; password: string }>({
        defaultValues: { email: "", password: "" }
      })
    );

    render(
      <MemoryRouter>
        <LoginCredentialsForm
          register={result.current.register}
          errors={result.current.formState.errors}
          isSubmitting={false}
          submit={vi.fn()}
          oauthProviders={[]}
          oauthButtons={[]}
          oauthPending={null}
          pendingEmail='alice@example.com'
          onResendVerification={vi.fn()}
          isResending={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("auth.login.resend")).toBeInTheDocument();
  });
});
