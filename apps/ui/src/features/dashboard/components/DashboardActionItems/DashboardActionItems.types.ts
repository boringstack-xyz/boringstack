export type IDashboardActionItemId =
  | "completeProfile"
  | "verifyEmail"
  | "pendingInvitations"
  | "unreadNotifications"
  | "billing";

export interface IDashboardActionItemsProps {
  readonly className?: string;
}

export interface IDashboardActionItemView {
  readonly id: IDashboardActionItemId;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly href: string;
}

export interface IDashboardActionItemsView {
  readonly className: string | undefined;
  readonly items: readonly IDashboardActionItemView[];
}
