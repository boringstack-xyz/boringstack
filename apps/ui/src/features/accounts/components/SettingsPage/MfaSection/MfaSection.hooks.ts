import type { BaseSyntheticEvent, ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { logger } from "@/lib/logger/logger";

import {
  useMfaDisable,
  useMfaRegenerateRecoveryCodes,
  useMfaSetup,
  useMfaVerifySetup
} from "@/features/auth/Auth.mfa.management.mutations";
import { useMfaStatus } from "@/features/auth/Auth.queries";
import type { IMfaSetupResponse } from "@/features/auth/Auth.types";

import { MFA_QR_SIZE_PX } from "./MfaSection.constants";
import type { IMfaSectionView, IMfaUiState } from "./MfaSection.types";

export function useMfaSection(): IMfaSectionView {
  const { t } = useTranslation();
  const status = useMfaStatus();
  const setup = useMfaSetup();
  const verifySetup = useMfaVerifySetup();
  const disable = useMfaDisable();
  const regenerate = useMfaRegenerateRecoveryCodes();

  const [pendingSetup, setPendingSetup] = useState<IMfaSetupResponse | null>(
    null
  );
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(
    null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enrollPassword, setEnrollPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  /*
   * Render the otpauth URI into a data: PNG when we hit the enrollment
   * step. Effect (rather than direct compute) because qrcode.toDataURL
   * is async.
   */
  useEffect(() => {
    const otpauthUri = pendingSetup?.otpauthUri ?? null;

    if (otpauthUri === null) {
      setQrDataUrl(null);

      return undefined;
    }

    let cancelled = false;

    QRCode.toDataURL(otpauthUri, { width: MFA_QR_SIZE_PX })
      .then((dataUrl) => {
        if (cancelled) {
          return;
        }

        setQrDataUrl(dataUrl);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setQrDataUrl(null);
        logger.warn({
          event: "auth.mfa_setup_failed",
          error: getErrorMessage(error)
        });
      });

    return () => {
      cancelled = true;
    };
  }, [pendingSetup]);

  const onStartEnrollment = useCallback((): void => {
    if (enrollPassword.trim() === "") {
      setEnrollError(t("accounts.settings.mfa.errors.passwordRequired"));

      return;
    }

    setEnrollError(null);

    setup.mutate(
      { password: enrollPassword },
      {
        onSuccess: (data) => {
          setPendingSetup(data);
          setFreshRecoveryCodes(null);
          setEnrollPassword("");
          setVerifyCode("");
          logger.info({ event: "auth.mfa_challenge_issued" });
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            setEnrollError(t("accounts.settings.mfa.errors.passwordIncorrect"));

            return;
          }

          setEnrollError(t("accounts.settings.mfa.errors.generic"));
          logger.warn({
            event: "auth.mfa_setup_failed",
            status: error instanceof ApiError ? error.status : undefined
          });
        }
      }
    );
  }, [enrollPassword, setup, t]);

  const onCancelEnrollment = useCallback((): void => {
    setPendingSetup(null);
    setVerifyCode("");
    setVerifyError(null);
  }, []);

  const onVerifyEnrollment = useCallback((): void => {
    if (pendingSetup === null) {
      return;
    }

    if (verifyCode.trim() === "") {
      setVerifyError(t("accounts.settings.mfa.errors.codeRequired"));

      return;
    }

    setVerifyError(null);

    verifySetup.mutate(
      { code: verifyCode.trim() },
      {
        onSuccess: () => {
          setFreshRecoveryCodes(pendingSetup.recoveryCodes);
          setPendingSetup(null);
          setVerifyCode("");
          toast.success(t("accounts.settings.mfa.notifications.enabled"));
          logger.info({ event: "auth.mfa_enabled" });
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError && error.status === 400) {
            setVerifyError(t("accounts.settings.mfa.errors.invalidCode"));

            return;
          }

          setVerifyError(t("accounts.settings.mfa.errors.generic"));
          logger.warn({
            event: "auth.mfa_verify_failed",
            status: error instanceof ApiError ? error.status : undefined
          });
        }
      }
    );
  }, [pendingSetup, verifyCode, verifySetup, t]);

  const onDisable = useCallback((): void => {
    if (disablePassword.trim() === "") {
      setDisableError(t("accounts.settings.mfa.errors.passwordRequired"));

      return;
    }

    setDisableError(null);

    disable.mutate(
      { password: disablePassword },
      {
        onSuccess: () => {
          setDisablePassword("");
          setFreshRecoveryCodes(null);
          toast.success(t("accounts.settings.mfa.notifications.disabled"));
          logger.info({ event: "auth.mfa_disabled" });
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            setDisableError(
              t("accounts.settings.mfa.errors.passwordIncorrect")
            );

            return;
          }

          setDisableError(t("accounts.settings.mfa.errors.generic"));
          logger.warn({
            event: "auth.mfa_disable_failed",
            status: error instanceof ApiError ? error.status : undefined
          });
        }
      }
    );
  }, [disable, disablePassword, t]);

  const onRegenerate = useCallback((): void => {
    if (regeneratePassword.trim() === "") {
      setRegenerateError(t("accounts.settings.mfa.errors.passwordRequired"));

      return;
    }

    setRegenerateError(null);

    regenerate.mutate(
      { password: regeneratePassword },
      {
        onSuccess: (data) => {
          setFreshRecoveryCodes(data.recoveryCodes);
          setRegeneratePassword("");
          toast.success(
            t("accounts.settings.mfa.notifications.codesRegenerated")
          );
          logger.info({ event: "auth.mfa_recovery_regenerated" });
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError && error.isUnauthorized) {
            setRegenerateError(
              t("accounts.settings.mfa.errors.passwordIncorrect")
            );

            return;
          }

          setRegenerateError(t("accounts.settings.mfa.errors.generic"));
        }
      }
    );
  }, [regenerate, regeneratePassword, t]);

  const handleEnrollPasswordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setEnrollPassword(event.target.value);
    },
    []
  );

  const handleVerifyCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setVerifyCode(event.target.value);
    },
    []
  );

  const handleDisablePasswordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setDisablePassword(event.target.value);
    },
    []
  );

  const handleRegeneratePasswordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setRegeneratePassword(event.target.value);
    },
    []
  );

  const handleStartEnrollmentSubmit = useCallback(
    (event: BaseSyntheticEvent): void => {
      event.preventDefault();
      onStartEnrollment();
    },
    [onStartEnrollment]
  );

  const handleVerifyEnrollmentSubmit = useCallback(
    (event: BaseSyntheticEvent): void => {
      event.preventDefault();
      onVerifyEnrollment();
    },
    [onVerifyEnrollment]
  );

  const handleRegenerateSubmit = useCallback(
    (event: BaseSyntheticEvent): void => {
      event.preventDefault();
      onRegenerate();
    },
    [onRegenerate]
  );

  const handleDisableSubmit = useCallback(
    (event: BaseSyntheticEvent): void => {
      event.preventDefault();
      onDisable();
    },
    [onDisable]
  );

  let state: IMfaUiState;

  if (status.isLoading) {
    state = { kind: "loading" };
  } else if (pendingSetup !== null) {
    state = { kind: "enrolling", setup: pendingSetup };
  } else if (status.data?.enabled === true) {
    state = { kind: "enabled", recoveryCodes: freshRecoveryCodes };
  } else {
    state = { kind: "disabled" };
  }

  return {
    state,
    t,
    enrollPassword,
    verifyCode,
    disablePassword,
    regeneratePassword,
    qrDataUrl,
    handleEnrollPasswordChange,
    handleVerifyCodeChange,
    handleDisablePasswordChange,
    handleRegeneratePasswordChange,
    handleStartEnrollmentSubmit,
    handleVerifyEnrollmentSubmit,
    handleRegenerateSubmit,
    handleDisableSubmit,
    onCancelEnrollment,
    isStarting: setup.isPending,
    isVerifying: verifySetup.isPending,
    isDisabling: disable.isPending,
    isRegenerating: regenerate.isPending,
    enrollError,
    verifyError,
    disableError,
    regenerateError
  };
}
