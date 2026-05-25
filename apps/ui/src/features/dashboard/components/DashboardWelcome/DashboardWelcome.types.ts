export interface IDashboardWelcomeProps {
  readonly className?: string;
  readonly displayName?: string;
  readonly hasActionItems?: boolean;
}

export interface IDashboardWelcomeView {
  readonly className: string | undefined;
  readonly eyebrow: string;
  readonly title: string;
  readonly subline: string;
}
