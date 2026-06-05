import type * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { useCapabilities } from "@/lib/api/queries/useCapabilities";
import { type IOAuthProvider, startOAuth } from "@/lib/auth/oauth.service";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { isRecord } from "@/lib/guards/isRecord";
import { logger } from "@/lib/logger/logger";

import {
  useMfaVerifyLogin,
  useMfaVerifyRecovery
} from "@/features/auth/Auth.mfa.challenge.mutations";
import { loginInputSchema } from "@/features/auth/Auth.schemas";
import { useLogin } from "@/features/auth/Auth.session.mutations";
import { useResendVerification } from "@/features/auth/Auth.signup.mutations";
import type { ILoginInput } from "@/features/auth/Auth.types";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import { DEFAULT_REDIRECT_TO, OAUTH_LABEL_KEYS } from "./LoginPage.constants";
import type { ILoginPageProps, ILoginPageView } from "./LoginPage.types";

function routePart(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function redirectTargetFromState(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.from)) {
    return DEFAULT_REDIRECT_TO;
  }

  const pathname = routePart(state.from.pathname);

  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return DEFAULT_REDIRECT_TO;
  }

  return `${pathname}${routePart(state.from.search)}${routePart(state.from.hash)}`;
}

export function useLoginPage(props: ILoginPageProps = {}): ILoginPageView {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const login = useLogin();
  const resend = useResendVerification();
  const capabilities = useCapabilities();
  const verifyTotp = useMfaVerifyLogin();
  const verifyRecovery = useMfaVerifyRecovery();

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(
    null
  );
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMode, setMfaMode] = useState<"totp" | "recovery">("totp");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ILoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" }
  });

  const redirectTarget =
    props.redirectTo ?? redirectTargetFromState(location.state);
  const capabilityProviders = capabilities.data?.oauth.providers;
  const oauthProviders = useMemo<IOAuthProvider[]>(
    () => capabilityProviders ?? [],
    [capabilityProviders]
  );
  const isGoogleOAuthEnabled = oauthProviders.includes("google");
  const isGithubOAuthEnabled = oauthProviders.includes("github");
  const isLinkedinOAuthEnabled = oauthProviders.includes("linkedin");

  const onSubmit = useCallback(
    async (input: ILoginInput): Promise<void> => {
      setPendingEmail(null);
      setMfaError(null);

      try {
        const result = await login.mutateAsync(input);

        if (result.kind === "mfa-required") {
          setMfaChallengeToken(result.challengeToken);
          setMfaCode("");
          setMfaMode("totp");
          logger.info({ event: "auth.mfa_challenge_issued" });

          return;
        }

        logger.info({ event: "auth.login_success" });
        await navigate(redirectTarget, { replace: true });
      } catch (error) {
        if (applyServerErrors(error, setError, ["email", "password"])) {
          return;
        }

        if (error instanceof ApiError && error.isEmailNotVerified) {
          setPendingEmail(input.email);
          toast.error(t("auth.login.errors.emailNotVerified"));
          logger.info({ event: "auth.login_blocked_unverified" });

          return;
        }

        const message =
          error instanceof ApiError && error.isUnauthorized
            ? t("auth.login.errors.invalidCredentials")
            : t("auth.login.errors.network");

        toast.error(message);
        logger.warn({
          event: "auth.login_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    },
    [login, navigate, redirectTarget, setError, t]
  );

  const submit = useCallback(
    (event: React.BaseSyntheticEvent): void => {
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit]
  );

  /*
   * OAuth redirects are full-page navigations; we track per-provider so the
   * pressed button shows a spinner while the other stays clickable.
   */
  const [oauthPending, setOauthPending] = useState<IOAuthProvider | null>(null);

  const onOAuth = useCallback(
    (provider: IOAuthProvider): void => {
      if (!oauthProviders.includes(provider)) {
        toast.error(t("auth.oauth.notConfigured"));

        return;
      }

      setOauthPending(provider);

      /*
       * startOAuth is synchronous (browser navigation) — wrap in try/catch
       * for the rare case of a malformed URL or blocked navigation. The
       * page unloads on success so this block is fire-and-forget.
       */
      try {
        startOAuth(provider);
      } catch (error) {
        setOauthPending(null);
        toast.error(t("auth.oauth.failed.title"));
        logger.warn({
          event: "auth.oauth_start_failed",
          provider,
          error: getErrorMessage(error)
        });
      }
    },
    [oauthProviders, t]
  );

  const onGoogle = useCallback((): void => {
    onOAuth("google");
  }, [onOAuth]);

  const onGithub = useCallback((): void => {
    onOAuth("github");
  }, [onOAuth]);

  const onLinkedin = useCallback((): void => {
    onOAuth("linkedin");
  }, [onOAuth]);

  const oauthButtons = useMemo(
    () =>
      oauthProviders.map((provider) => ({
        provider,
        labelKey: OAUTH_LABEL_KEYS[provider],
        onClick: () => {
          onOAuth(provider);
        }
      })),
    [oauthProviders, onOAuth]
  );

  const onMfaCodeChange = useCallback((value: string): void => {
    setMfaCode(value);
  }, []);

  const onMfaModeToggle = useCallback((): void => {
    setMfaMode((current) => (current === "totp" ? "recovery" : "totp"));
    setMfaCode("");
    setMfaError(null);
  }, []);

  const onMfaSubmit = useCallback((): void => {
    if (mfaChallengeToken === null || mfaCode.trim() === "") {
      return;
    }

    setMfaError(null);

    const mutation = mfaMode === "totp" ? verifyTotp : verifyRecovery;

    mutation.mutate(
      { challengeToken: mfaChallengeToken, code: mfaCode.trim() },
      {
        onSuccess: () => {
          logger.info({ event: "auth.mfa_login_success" });
          setMfaChallengeToken(null);
          setMfaCode("");
          void navigate(redirectTarget, { replace: true });
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            setMfaError(t("auth.login.mfa.invalidCode"));
            setMfaCode("");

            return;
          }

          setMfaError(t("auth.login.errors.network"));
          logger.warn({
            event: "auth.mfa_verify_failed",
            status: error instanceof ApiError ? error.status : undefined
          });
        }
      }
    );
  }, [
    mfaChallengeToken,
    mfaCode,
    mfaMode,
    navigate,
    redirectTarget,
    t,
    verifyRecovery,
    verifyTotp
  ]);

  const onResendVerification = useCallback((): void => {
    if (pendingEmail === null) {
      return;
    }

    resend.mutate(
      { email: pendingEmail },
      {
        onSuccess: () => {
          toast.success(t("auth.login.errors.resendSent"));
        },
        onError: (error: unknown) => {
          toast.error(t("auth.login.errors.network"));
          logger.warn({
            event: "auth.verification_resend_failed",
            status: error instanceof ApiError ? error.status : undefined
          });
        }
      }
    );
  }, [pendingEmail, resend, t]);

  return {
    register,
    handleSubmit,
    errors,
    isSubmitting: isSubmitting || login.isPending,
    onSubmit,
    submit,
    onOAuth,
    onGoogle,
    onGithub,
    onLinkedin,
    oauthProviders,
    oauthButtons,
    oauthPending,
    isGoogleOAuthEnabled,
    isGithubOAuthEnabled,
    isLinkedinOAuthEnabled,
    pendingEmail,
    onResendVerification,
    isResending: resend.isPending,
    mfaChallengeToken,
    mfaCode,
    onMfaCodeChange,
    onMfaSubmit,
    isMfaSubmitting: verifyTotp.isPending || verifyRecovery.isPending,
    mfaError,
    mfaMode,
    onMfaModeToggle
  };
}
