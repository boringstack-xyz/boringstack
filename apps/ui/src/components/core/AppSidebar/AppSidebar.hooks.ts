import {
  Bell,
  CreditCard,
  History,
  LayoutDashboard,
  Settings,
  User,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ROLE } from "@/lib/acl/acl.types";
import { useCapabilities } from "@/lib/api/queries/useCapabilities";

import { useMe } from "@/features/auth/Auth.queries";

import { APP_SIDEBAR_NAV_ITEMS } from "./AppSidebar.constants";
import type {
  IAppSidebarNavId,
  IAppSidebarNavItemView,
  IAppSidebarProps,
  IAppSidebarView
} from "./AppSidebar.types";

export function useAppSidebar(props: IAppSidebarProps): IAppSidebarView {
  const { t } = useTranslation();
  const me = useMe();
  const capabilities = useCapabilities();

  const showBilling =
    capabilities.data?.features.billing.enabled === true &&
    me.data?.role === ROLE.owner;

  const icons: Record<IAppSidebarNavId, LucideIcon> = {
    dashboard: LayoutDashboard,
    notifications: Bell,
    team: Users,
    auditLog: History,
    settings: Settings,
    billing: CreditCard,
    profile: User
  };

  const items: IAppSidebarNavItemView[] = APP_SIDEBAR_NAV_ITEMS.filter(
    (item) => item.id !== "billing" || showBilling
  ).map((item) => ({
    id: item.id,
    path: item.path,
    label: t(item.labelKey),
    icon: icons[item.id]
  }));

  return {
    className: props.className,
    onNavigate: props.onNavigate,
    ariaLabel: t("nav.ariaPrimary"),
    items
  };
}
