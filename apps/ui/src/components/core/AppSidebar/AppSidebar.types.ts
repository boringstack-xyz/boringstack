import type { LucideIcon } from "lucide-react";

export type IAppSidebarNavId =
  | "dashboard"
  | "notifications"
  | "team"
  | "auditLog"
  | "settings"
  | "billing"
  | "profile";

export interface IAppSidebarNavItemView {
  readonly id: IAppSidebarNavId;
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface IAppSidebarProps {
  readonly className?: string;
  readonly onNavigate?: () => void;
}

export interface ISidebarItemProps {
  readonly item: IAppSidebarNavItemView;
  readonly onNavigate: (() => void) | undefined;
}

export interface IAppSidebarView {
  readonly className: string | undefined;
  readonly onNavigate: (() => void) | undefined;
  readonly ariaLabel: string;
  readonly items: readonly IAppSidebarNavItemView[];
}
