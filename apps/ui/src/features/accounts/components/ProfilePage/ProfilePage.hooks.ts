import type { BaseSyntheticEvent } from "react";
import { useCallback, useEffect } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/ApiError";
import { logger } from "@/lib/logger/logger";

import { useUpdateProfile } from "@/features/auth/Auth.profile.mutations";
import { useMe } from "@/features/auth/Auth.queries";
import { updateProfileInputSchema } from "@/features/auth/Auth.schemas";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import type { IProfileFormInput, IProfilePageView } from "./ProfilePage.types";

function deriveInitials(
  firstName: string,
  lastName: string,
  email: string
): string {
  const first = firstName.trim();
  const last = lastName.trim();

  if (first.length > 0 || last.length > 0) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

function deriveDisplayName(
  firstName: string,
  lastName: string,
  email: string
): string {
  const combined = `${firstName.trim()} ${lastName.trim()}`.trim();

  return combined.length > 0 ? combined : email;
}

export function useProfilePage(): IProfilePageView {
  const { t } = useTranslation();
  const me = useMe();
  const updateProfile = useUpdateProfile();

  const user = me.data?.user;
  const email = user?.email ?? "";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<IProfileFormInput>({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: { firstName: "", lastName: "" }
  });

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    reset({
      firstName: user.firstName,
      lastName: user.lastName
    });
  }, [reset, user]);

  const onSubmit = useCallback(
    async (input: IProfileFormInput): Promise<void> => {
      try {
        await updateProfile.mutateAsync(input);
        toast.success(t("accounts.profile.saveSuccess"));
        logger.info({ event: "profile.updated" });
      } catch (error) {
        if (applyServerErrors(error, setError)) {
          return;
        }

        toast.error(t("accounts.profile.saveError"));
        logger.warn({
          event: "profile.update_failed",
          status: error instanceof ApiError ? error.status : undefined
        });
      }
    },
    [setError, t, updateProfile]
  );

  const submit = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit]
  );

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const initials =
    user !== undefined ? deriveInitials(firstName, lastName, user.email) : "";
  const displayName =
    user !== undefined
      ? deriveDisplayName(firstName, lastName, user.email)
      : "";

  return {
    pageTitle: t("accounts.profile.pageTitle"),
    pageSubtitle: t("accounts.profile.pageSubtitle"),
    email,
    emailHint: t("accounts.profile.fields.emailHint"),
    firstNameLabel: t("accounts.profile.fields.firstName"),
    lastNameLabel: t("accounts.profile.fields.lastName"),
    emailLabel: t("accounts.profile.fields.email"),
    identityLabel: t("accounts.profile.identityLabel"),
    saveLabel: t("accounts.profile.save"),
    savingLabel: t("accounts.profile.saving"),
    saveSuccessLabel: t("accounts.profile.saveSuccess"),
    initials,
    displayName,
    register,
    errors,
    isSubmitting: isSubmitting || updateProfile.isPending,
    submit
  };
}
