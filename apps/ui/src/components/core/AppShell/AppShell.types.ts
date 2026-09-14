import type { ReactNode } from "react";

import type { IMe } from "@/lib/session";

import type { IAppPageHeaderState } from "@/components/core/AppPage";

export interface IAppShellProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export interface IAppShellView {
  readonly user: IMe["user"] | null;
  readonly displayName: string;
  readonly onLogout: () => void;
  readonly isLoggingOut: boolean;
  readonly className: string | undefined;
  readonly isMobileNavOpen: boolean;
  readonly onMobileNavOpenChange: (open: boolean) => void;
  readonly openMobileNav: () => void;
  readonly closeMobileNav: () => void;
  readonly pageHeader: IAppPageHeaderState | null;
}
