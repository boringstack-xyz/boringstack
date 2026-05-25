import type { BaseSyntheticEvent } from "react";
import { useCallback, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import { useForgotPassword } from "@/features/auth/Auth.password.mutations";
import { forgotPasswordInputSchema } from "@/features/auth/Auth.schemas";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import type {
  IForgotPasswordFormInput,
  IForgotPasswordPageProps,
  IForgotPasswordPageView
} from "./ForgotPasswordPage.types";

export function useForgotPasswordPage(
  _props: IForgotPasswordPageProps = {}
): IForgotPasswordPageView {
  const { t } = useTranslation();
  const forgotPassword = useForgotPassword();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<IForgotPasswordFormInput>({
    resolver: zodResolver(forgotPasswordInputSchema),
    defaultValues: { email: "" }
  });

  const onSubmit = useCallback(
    async (input: IForgotPasswordFormInput): Promise<void> => {
      try {
        await forgotPassword.mutateAsync(input);
        setSubmittedEmail(input.email);
        logger.info({ event: "auth.forgot_password_requested" });
      } catch (error) {
        if (applyServerErrors(error, setError)) {
          return;
        }

        toast.error(t("auth.forgotPassword.errors.network"));
        logger.warn({
          event: "auth.forgot_password_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    },
    [forgotPassword, setError, t]
  );

  const submit = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit]
  );

  return {
    register,
    errors,
    isSubmitting: isSubmitting || forgotPassword.isPending,
    submit,
    submittedEmail
  };
}
