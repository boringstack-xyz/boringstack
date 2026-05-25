import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCapabilities } from "@/lib/api/queries/useCapabilities";
import { logger } from "@/lib/logger/logger";
import { displayName } from "@/lib/users/display-name";

import { useAppPageHeader } from "@/components/core/AppPage";

import { useMe } from "@/features/auth/Auth.queries";
import { useLogout } from "@/features/auth/Auth.session.mutations";
import { useNotificationStream } from "@/features/notifications/useNotificationStream";

import { POST_LOGOUT_PATH } from "./AppShell.constants";
import type { IAppShellProps, IAppShellView } from "./AppShell.types";

export function useAppShell(props: IAppShellProps): IAppShellView {
  const navigate = useNavigate();
  const me = useMe();
  const capabilities = useCapabilities();
  const logout = useLogout();
  const isNotificationStreamEnabled =
    capabilities.data?.features.notifications.sse === true;

  useNotificationStream(isNotificationStreamEnabled);

  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const pageHeader = useAppPageHeader();

  const onLogout = useCallback((): void => {
    logout.mutate(undefined, {
      onSuccess: () => {
        logger.info({ event: "auth.logout_success" });
        void navigate(POST_LOGOUT_PATH, { replace: true });
      }
    });
  }, [logout, navigate]);

  const openMobileNav = useCallback((): void => {
    setMobileNavOpen(true);
  }, []);

  const closeMobileNav = useCallback((): void => {
    setMobileNavOpen(false);
  }, []);

  return {
    user: me.data?.user ?? null,
    displayName: me.data ? displayName(me.data.user) : "",
    onLogout,
    isLoggingOut: logout.isPending,
    className: props.className,
    isMobileNavOpen,
    onMobileNavOpenChange: setMobileNavOpen,
    openMobileNav,
    closeMobileNav,
    pageHeader
  };
}
