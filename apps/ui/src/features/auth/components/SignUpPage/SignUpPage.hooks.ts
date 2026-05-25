import type { BaseSyntheticEvent } from "react";
import { useCallback, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import { registerInputSchema } from "@/features/auth/Auth.schemas";
import {
  useRegister,
  useResendVerification
} from "@/features/auth/Auth.signup.mutations";
import type { IRegisterInput } from "@/features/auth/Auth.types";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import type { ISignUpPageProps, ISignUpPageView } from "./SignUpPage.types";

export function useSignUpPage(_props: ISignUpPageProps = {}): ISignUpPageView {
  const { t } = useTranslation();
  const registerMutation = useRegister();
  const resend = useResendVerification();

  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<IRegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "" }
  });

  const onSubmit = useCallback(
    async (input: IRegisterInput): Promise<void> => {
      try {
        await registerMutation.mutateAsync(input);
        setSubmittedEmail(input.email);
        logger.info({ event: "auth.signup_success" });
      } catch (error) {
        if (applyServerErrors(error, setError)) {
          return;
        }

        if (
          error instanceof ApiError &&
          (error.status === 409 || error.status === 422)
        ) {
          toast.error(t("auth.signup.errors.emailTaken"));
          logger.info({ event: "auth.signup_email_conflict" });

          return;
        }

        toast.error(t("auth.signup.errors.network"));
        logger.warn({
          event: "auth.signup_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    },
    [registerMutation, setError, t]
  );

  const submit = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit]
  );

  const onResend = useCallback((): void => {
    if (submittedEmail === null) {
      return;
    }

    resend.mutate(
      { email: submittedEmail },
      {
        onSuccess: () => {
          toast.success(t("auth.login.errors.resendSent"));
        },
        onError: () => {
          toast.error(t("auth.signup.errors.network"));
        }
      }
    );
  }, [resend, submittedEmail, t]);

  return {
    register,
    errors,
    isSubmitting: isSubmitting || registerMutation.isPending,
    submit,
    submittedEmail,
    onResend,
    isResending: resend.isPending
  };
}
