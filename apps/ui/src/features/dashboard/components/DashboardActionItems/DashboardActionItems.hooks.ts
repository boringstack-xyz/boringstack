import { useMemo } from "react";

import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/lib/api/queries/useCapabilities";

import { useMe } from "@/features/auth/Auth.queries";
import {
  useDashboardPendingInvitations,
  useDashboardUnreadCount
} from "@/features/dashboard/Dashboard.queries";

import { DASHBOARD_ACTION_ITEMS_ROUTES } from "./DashboardActionItems.constants";
import type {
  IDashboardActionItemView,
  IDashboardActionItemsProps,
  IDashboardActionItemsView
} from "./DashboardActionItems.types";

export function useDashboardActionItems(
  props: IDashboardActionItemsProps
): IDashboardActionItemsView {
  const { t } = useTranslation();
  const me = useMe();
  const capabilities = useCapabilities();
  const accountId = me.data?.account.id;
  const invitations = useDashboardPendingInvitations(accountId);
  const unreadNotifications = useDashboardUnreadCount();

  const items = useMemo(() => {
    const nextItems: IDashboardActionItemView[] = [];
    const firstName = me.data?.user.firstName.trim() ?? "";
    const lastName = me.data?.user.lastName.trim() ?? "";
    const hasCompleteProfile = firstName !== "" && lastName !== "";

    if (!hasCompleteProfile) {
      nextItems.push({
        id: "completeProfile",
        title: t("dashboard.actions.completeProfile.title"),
        body: t("dashboard.actions.completeProfile.body"),
        ctaLabel: t("dashboard.actions.completeProfile.cta"),
        href: DASHBOARD_ACTION_ITEMS_ROUTES.profile
      });
    }

    if (me.data?.user.emailVerified === false) {
      nextItems.push({
        id: "verifyEmail",
        title: t("dashboard.actions.verifyEmail.title"),
        body: t("dashboard.actions.verifyEmail.body", {
          email: me.data.user.email
        }),
        ctaLabel: t("dashboard.actions.verifyEmail.cta"),
        href: DASHBOARD_ACTION_ITEMS_ROUTES.profile
      });
    }

    const invitationCount = invitations.data ?? 0;
    const canInviteTeam = me.data?.features.can_invite_team === true;

    if (canInviteTeam || invitationCount > 0) {
      nextItems.push({
        id: "pendingInvitations",
        title: t("dashboard.actions.pendingInvitations.title"),
        body: t("dashboard.actions.pendingInvitations.body", {
          count: invitationCount
        }),
        ctaLabel: t("dashboard.actions.pendingInvitations.cta"),
        href: DASHBOARD_ACTION_ITEMS_ROUTES.invitations
      });
    }

    const unreadCount = unreadNotifications.data ?? 0;

    if (unreadCount > 0) {
      nextItems.push({
        id: "unreadNotifications",
        title: t("dashboard.actions.unreadNotifications.title"),
        body: t("dashboard.actions.unreadNotifications.body", {
          count: unreadCount
        }),
        ctaLabel: t("dashboard.actions.unreadNotifications.cta"),
        href: DASHBOARD_ACTION_ITEMS_ROUTES.notifications
      });
    }

    const isBillingEnabled =
      capabilities.data?.features.billing.enabled === true;
    const hasBillingCapability = me.data?.capabilities.billing === true;
    const isFreeTier = me.data?.features.can_export === false;

    if (isBillingEnabled && hasBillingCapability && isFreeTier) {
      nextItems.push({
        id: "billing",
        title: t("dashboard.actions.billing.title"),
        body: t("dashboard.actions.billing.body"),
        ctaLabel: t("dashboard.actions.billing.cta"),
        href: DASHBOARD_ACTION_ITEMS_ROUTES.billing
      });
    }

    return nextItems;
  }, [
    capabilities.data?.features.billing.enabled,
    invitations.data,
    me.data?.capabilities.billing,
    me.data?.features.can_export,
    me.data?.features.can_invite_team,
    me.data?.user.email,
    me.data?.user.emailVerified,
    me.data?.user.firstName,
    me.data?.user.lastName,
    t,
    unreadNotifications.data
  ]);

  return {
    className: props.className,
    items
  };
}
