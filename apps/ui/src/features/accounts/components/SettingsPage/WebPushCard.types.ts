export interface IWebPushCardProps {
  readonly className?: string;
}

export interface IWebPushCardView {
  readonly title: string;
  readonly body: string;
  readonly stateLabel: string;
  readonly buttonLabel: string;
  readonly onAction: () => void;
  readonly canAct: boolean;
  readonly isPending: boolean;
}
