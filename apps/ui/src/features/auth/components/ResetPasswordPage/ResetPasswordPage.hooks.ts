import type { BaseSyntheticEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import { useResetPassword } from "@/features/auth/Auth.password.mutations";
import { resetPasswordInputSchema } from "@/features/auth/Auth.schemas";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import type {
  IResetPasswordFormInput,
  IResetPasswordPageProps,
  IResetPasswordPageView
} from "./ResetPasswordPage.types";

export function useResetPasswordPage(
  _props: IResetPasswordPageProps = {}
): IResetPasswordPageView {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const resetPassword = useResetPassword();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInvalidToken, setIsInvalidToken] = useState(false);

  const token = searchParams.get("token")?.trim() ?? "";
  const hasToken = token !== "";
  const formSchema = useMemo(
    () => resetPasswordInputSchema.omit({ token: true }),
    []
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<IResetPasswordFormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" }
  });

  const onSubmit = useCallback(
    async (input: IResetPasswordFormInput): Promise<void> => {
      if (!hasToken) {
        setIsInvalidToken(false);

        return;
      }

      setIsInvalidToken(false);

      try {
        await resetPassword.mutateAsync({
          token,
          password: input.password
        });
        setIsSuccess(true);
        logger.info({ event: "auth.reset_password_success" });
      } catch (error) {
        if (applyServerErrors(error, setError, ["password"])) {
          if (
            error instanceof ApiError &&
            error.fieldErrors?.token !== undefined
          ) {
            setIsInvalidToken(true);
          }

          return;
        }

        if (
          error instanceof ApiError &&
          (error.isValidation || error.status === 404)
        ) {
          setIsInvalidToken(true);
        } else {
          toast.error(t("auth.resetPassword.errors.network"));
        }

        logger.warn({
          event: "auth.reset_password_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    },
    [hasToken, resetPassword, setError, t, token]
  );

  const submit = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit]
  );

  let state: IResetPasswordPageView["state"] = "form";

  if (!hasToken) {
    state = "missingToken";
  } else if (isSuccess) {
    state = "success";
  } else if (isInvalidToken) {
    state = "invalidToken";
  }

  return {
    state,
    register,
    errors,
    isSubmitting: isSubmitting || resetPassword.isPending,
    submit
  };
}
