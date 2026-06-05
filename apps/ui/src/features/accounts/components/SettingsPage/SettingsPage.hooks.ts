import {
  type BaseSyntheticEvent,
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useNavigate } from "react-router-dom";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type FieldErrors,
  type UseFormRegister,
  useForm
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ROLE } from "@/lib/acl/acl.types";
import { ApiError } from "@/lib/api/ApiError";
import { useCapabilities } from "@/lib/api/queries/useCapabilities";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger/logger";

import { useDisconnectOAuth } from "@/features/auth/Auth.oauth.mutations";
import { useChangePassword } from "@/features/auth/Auth.password.mutations";
import { useMe } from "@/features/auth/Auth.queries";
import { changePasswordInputSchema } from "@/features/auth/Auth.schemas";
import { applyServerErrors } from "@/features/auth/Auth.utils";

import { useDeleteAccount, useUpdateAccount } from "../../Accounts.mutations";
import { useLeaveAccount } from "../../Memberships.mutations";
import { SETTINGS_SECTION_KEYS } from "./SettingsPage.constants";
import { renameAccountSchema } from "./SettingsPage.schemas";
import type {
  IOAuthProviderRow,
  ISettingsDetailRowView,
  ISettingsSectionView
} from "./SettingsPage.types";

interface ISettingsPageView {
  readonly pageTitle: string;
  readonly pageSubtitle: string;
  readonly sections: readonly ISettingsSectionView[];
  readonly accountRows: readonly ISettingsDetailRowView[];
  readonly securityRows: readonly ISettingsDetailRowView[];
  readonly oauthProviders: readonly IOAuthProviderRow[];
  readonly registerAccountName: UseFormRegister<{ name: string }>;
  readonly accountNameErrors: FieldErrors<{ name: string }>;
  readonly registerPassword: UseFormRegister<{
    currentPassword: string;
    newPassword: string;
  }>;
  readonly passwordErrors: FieldErrors<{
    currentPassword: string;
    newPassword: string;
  }>;
  readonly isRenamingAccount: boolean;
  readonly isChangingPassword: boolean;
  readonly disconnectingProvider: string | null;
  readonly isPasswordLoginEnabled: boolean;
  readonly submitRenameAccount: (event: BaseSyntheticEvent) => void;
  readonly submitChangePassword: (event: BaseSyntheticEvent) => void;
  readonly onConnectProvider: (provider: string) => void;
  readonly onDisconnectProvider: (provider: string) => void;
  readonly deleteConfirmation: string;
  readonly deleteConfirmationTarget: string;
  readonly canDeleteAccount: boolean;
  readonly isDeletingAccount: boolean;
  readonly isDeleteDisabled: boolean;
  readonly deleteError: string | null;
  readonly onDeleteConfirmationInputChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  readonly onDeleteAccount: () => void;
  readonly canLeaveAccount: boolean;
  readonly isLeavingAccount: boolean;
  readonly leaveError: string | null;
  readonly onLeaveAccount: () => void;
}

export function useSettingsPage(): ISettingsPageView {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const capabilities = useCapabilities();
  const meData = me.data;
  const accountId = meData?.account.id;
  const updateAccount = useUpdateAccount(accountId);
  const changePassword = useChangePassword();
  const disconnectOAuth = useDisconnectOAuth();
  const deleteAccount = useDeleteAccount(accountId);
  const leaveAccount = useLeaveAccount(accountId);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [disconnectingProvider, setDisconnectingProvider] = useState<
    string | null
  >(null);

  const sections: ISettingsSectionView[] = SETTINGS_SECTION_KEYS.map((id) => ({
    id,
    title: t(`accounts.settings.sections.${id}.title`),
    body: t(`accounts.settings.sections.${id}.body`)
  }));

  const unavailable = t("accounts.settings.unavailable");
  const activeAccountName = meData?.account.name ?? unavailable;
  const rawFullName =
    meData === undefined || meData === null
      ? ""
      : `${meData.user.firstName} ${meData.user.lastName}`.trim();
  let fullName = unavailable;

  if (meData !== undefined && meData !== null) {
    fullName = rawFullName === "" ? meData.user.email : rawFullName;
  }

  const emailVerification =
    meData?.user.emailVerified === true
      ? t("accounts.settings.status.emailVerified")
      : t("accounts.settings.status.emailUnverified");
  const membershipCount = meData?.memberships.length ?? 0;
  const canDeleteAccount = meData?.role === ROLE.owner;
  const isDeleteConfirmationMatch = meData?.account.name === deleteConfirmation;
  const isDeleteDisabled =
    !canDeleteAccount || !isDeleteConfirmationMatch || deleteAccount.isPending;
  /*
   * Owner cannot leave — the API rejects it because an account must
   * always have an owner. Owner uses the delete + transfer flows
   * instead.
   */
  const canLeaveAccount =
    meData !== undefined && meData !== null && meData.role !== ROLE.owner;
  const isPasswordLoginEnabled = meData?.hasPasswordLogin === true;

  const oauthProviderSet = useMemo(
    () => new Set(meData?.authProviders ?? []),
    [meData?.authProviders]
  );
  const oauthProviders: IOAuthProviderRow[] = useMemo(
    () =>
      (capabilities.data?.oauth.providers ?? []).map((provider) => ({
        provider,
        isLinked: oauthProviderSet.has(provider)
      })),
    [capabilities.data?.oauth.providers, oauthProviderSet]
  );

  const {
    register: registerRenameAccount,
    handleSubmit: handleRenameAccountSubmit,
    reset: resetRenameAccount,
    setError: setRenameAccountError,
    formState: { errors: accountNameErrors, isSubmitting: isRenamingAccount }
  } = useForm<{ name: string }>({
    resolver: zodResolver(renameAccountSchema),
    defaultValues: { name: meData?.account.name ?? "" }
  });

  const {
    register: registerPassword,
    handleSubmit: handleChangePasswordSubmit,
    setError: setChangePasswordError,
    reset: resetChangePassword,
    formState: { errors: passwordErrors, isSubmitting: isChangingPassword }
  } = useForm<{ currentPassword: string; newPassword: string }>({
    resolver: zodResolver(changePasswordInputSchema),
    defaultValues: { currentPassword: "", newPassword: "" }
  });

  const onRenameAccount = useCallback(
    async (input: { name: string }): Promise<void> => {
      const nextName = input.name.trim();

      if (nextName === "" || nextName === meData?.account.name) {
        return;
      }

      try {
        await updateAccount.mutateAsync({ name: nextName });
        toast.success(t("accounts.settings.account.renameSuccess"));
        logger.info({ event: "settings.account_renamed" });
      } catch (error) {
        if (applyServerErrors(error, setRenameAccountError, ["name"])) {
          return;
        }

        toast.error(t("accounts.settings.account.renameError"));
      }
    },
    [meData?.account.name, setRenameAccountError, t, updateAccount]
  );

  const submitRenameAccount = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleRenameAccountSubmit(onRenameAccount)(event);
    },
    [handleRenameAccountSubmit, onRenameAccount]
  );

  const onChangePassword = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
    }): Promise<void> => {
      try {
        await changePassword.mutateAsync(input);
        resetChangePassword({ currentPassword: "", newPassword: "" });
        toast.success(t("accounts.settings.security.passwordChanged"));
        logger.info({ event: "settings.password_changed" });
      } catch (error) {
        if (
          applyServerErrors(error, setChangePasswordError, [
            "currentPassword",
            "newPassword"
          ])
        ) {
          return;
        }

        toast.error(t("accounts.settings.security.passwordChangeError"));
      }
    },
    [changePassword, resetChangePassword, setChangePasswordError, t]
  );

  const submitChangePassword = useCallback(
    (event: BaseSyntheticEvent): void => {
      void handleChangePasswordSubmit(onChangePassword)(event);
    },
    [handleChangePasswordSubmit, onChangePassword]
  );

  const onConnectProvider = useCallback((provider: string): void => {
    const baseUrl = env.VITE_API_URL.replace(/\/$/, "");

    window.location.assign(`${baseUrl}/api/v1/auth/oauth/${provider}/link`);
  }, []);

  const onDisconnectProvider = useCallback(
    (provider: string): void => {
      setDisconnectingProvider(provider);
      disconnectOAuth.mutate(
        { provider },
        {
          onSuccess: () => {
            toast.success(t("accounts.settings.oauth.disconnectSuccess"));
            logger.info({ event: "settings.oauth_disconnected", provider });
          },
          onError: (error: unknown) => {
            toast.error(t("accounts.settings.oauth.disconnectError"));
            logger.warn({
              event: "settings.oauth_disconnected",
              provider,
              status: error instanceof ApiError ? error.status : undefined
            });
          },
          onSettled: () => {
            setDisconnectingProvider((current) =>
              current === provider ? null : current
            );
          }
        }
      );
    },
    [disconnectOAuth, t]
  );

  const accountRows: ISettingsDetailRowView[] = [
    {
      id: "accountName",
      label: t("accounts.settings.fields.accountName"),
      value: activeAccountName
    },
    {
      id: "role",
      label: t("accounts.settings.fields.role"),
      value:
        meData?.role === undefined
          ? unavailable
          : t(`accounts.settings.roles.${meData.role}`)
    },
    {
      id: "workspaceCount",
      label: t("accounts.settings.fields.workspaceCount"),
      value: String(membershipCount)
    }
  ];

  const securityRows: ISettingsDetailRowView[] = [
    {
      id: "user",
      label: t("accounts.settings.fields.user"),
      value: fullName
    },
    {
      id: "email",
      label: t("accounts.settings.fields.email"),
      value: meData?.user.email ?? unavailable
    },
    {
      id: "emailStatus",
      label: t("accounts.settings.fields.emailStatus"),
      value: emailVerification
    }
  ];

  useEffect(() => {
    if (meData === undefined || meData === null) {
      return;
    }

    resetRenameAccount({ name: meData.account.name });
  }, [meData, resetRenameAccount]);

  const onDeleteAccount = useCallback((): void => {
    if (isDeleteDisabled) {
      return;
    }

    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        void navigate("/login", { replace: true });
      }
    });
  }, [deleteAccount, isDeleteDisabled, navigate]);

  const onDeleteConfirmationInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setDeleteConfirmation(event.target.value);
    },
    []
  );

  const onLeaveAccount = useCallback((): void => {
    if (!canLeaveAccount || leaveAccount.isPending) {
      return;
    }

    leaveAccount.mutate(undefined, {
      onSuccess: () => {
        /*
         * After leaving, the user's JWT still points at the now-revoked
         * membership. The next /me refetch fails authz, so route them
         * to /login and let the next sign-in pick a remaining account.
         */
        void navigate("/login", { replace: true });
      }
    });
  }, [canLeaveAccount, leaveAccount, navigate]);

  return {
    pageTitle: t("accounts.settings.pageTitle"),
    pageSubtitle: t("accounts.settings.pageSubtitle"),
    sections,
    accountRows,
    securityRows,
    deleteConfirmation,
    deleteConfirmationTarget: meData?.account.name ?? "",
    canDeleteAccount,
    isDeletingAccount: deleteAccount.isPending,
    isDeleteDisabled,
    deleteError: deleteAccount.isError
      ? t("accounts.settings.sections.danger.error")
      : null,
    registerAccountName: registerRenameAccount,
    accountNameErrors,
    registerPassword,
    passwordErrors,
    isRenamingAccount: isRenamingAccount || updateAccount.isPending,
    isChangingPassword: isChangingPassword || changePassword.isPending,
    disconnectingProvider,
    isPasswordLoginEnabled,
    submitRenameAccount,
    submitChangePassword,
    oauthProviders,
    onConnectProvider,
    onDisconnectProvider,
    onDeleteConfirmationInputChange,
    onDeleteAccount,
    canLeaveAccount,
    isLeavingAccount: leaveAccount.isPending,
    leaveError: leaveAccount.isError
      ? t("accounts.settings.sections.danger.leaveError")
      : null,
    onLeaveAccount
  };
}
