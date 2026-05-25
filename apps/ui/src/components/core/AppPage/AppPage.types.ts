import type { ReactNode } from "react";

export interface IAppPageHeaderState {
  readonly actions?: ReactNode;
  readonly eyebrow?: string;
  readonly subtitle?: string;
  readonly title: string;
}

export interface IAppPageHeaderContextValue {
  readonly header: IAppPageHeaderState | null;
  readonly setHeader: (header: IAppPageHeaderState | null) => void;
}

export interface IAppPageProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly eyebrow?: string;
  readonly pageTitle: string;
  readonly subtitle?: string;
  readonly title?: string;
}
