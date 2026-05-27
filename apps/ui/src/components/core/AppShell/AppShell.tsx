import type { FC } from "react";
import { Link } from "react-router-dom";

import { Menu, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/classnames";

import {
  APP_PAGE_SHELL_EYEBROW_CLASS_NAME,
  APP_PAGE_SHELL_HEADER_TEST_ID,
  APP_PAGE_SHELL_SUBTITLE_CLASS_NAME,
  APP_PAGE_SHELL_TITLE_CLASS_NAME,
  AppPageHeaderProvider
} from "@/components/core/AppPage";
import { AppSidebar } from "@/components/core/AppSidebar";
import { ThemeToggle } from "@/components/core/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

import { AccountSwitcher } from "@/features/accounts/components/AccountSwitcher";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

import { useAppShell } from "./AppShell.hooks";
import type { IAppShellProps } from "./AppShell.types";

const AppShellPageHeader: FC<{
  readonly className?: string;
  readonly eyebrow?: string;
  readonly subtitle?: string;
  readonly title: string;
}> = ({ className, eyebrow, subtitle, title }) => (
  <div className={cn("min-w-0", className)}>
    {eyebrow !== undefined ? (
      <span className={APP_PAGE_SHELL_EYEBROW_CLASS_NAME}>{eyebrow}</span>
    ) : null}
    <h1 className={APP_PAGE_SHELL_TITLE_CLASS_NAME}>{title}</h1>
    {subtitle !== undefined ? (
      <p className={APP_PAGE_SHELL_SUBTITLE_CLASS_NAME}>{subtitle}</p>
    ) : null}
  </div>
);

AppShellPageHeader.displayName = "AppShellPageHeader";

const AppShellFrame: FC<IAppShellProps> = (props) => {
  const { t } = useTranslation();
  const {
    displayName,
    onLogout,
    isLoggingOut,
    className,
    isMobileNavOpen,
    onMobileNavOpenChange,
    openMobileNav,
    closeMobileNav,
    pageHeader
  } = useAppShell(props);

  const renderedDesktopPageHeader =
    pageHeader !== null ? (
      <div
        data-testid={APP_PAGE_SHELL_HEADER_TEST_ID}
        className='hidden min-w-0 flex-1 items-center gap-4 md:flex'
      >
        <AppShellPageHeader
          eyebrow={pageHeader.eyebrow}
          subtitle={pageHeader.subtitle}
          title={pageHeader.title}
        />
        {pageHeader.actions !== undefined ? (
          <div className='shrink-0'>{pageHeader.actions}</div>
        ) : null}
      </div>
    ) : null;

  const renderedMobilePageHeader =
    pageHeader !== null ? (
      <div
        data-testid={`${APP_PAGE_SHELL_HEADER_TEST_ID}-mobile`}
        className='border-border flex items-start justify-between gap-3 border-t px-4 py-3 md:hidden'
      >
        <AppShellPageHeader
          eyebrow={pageHeader.eyebrow}
          subtitle={pageHeader.subtitle}
          title={pageHeader.title}
        />
        {pageHeader.actions !== undefined ? (
          <div className='shrink-0'>{pageHeader.actions}</div>
        ) : null}
      </div>
    ) : null;

  return (
    <Sheet open={isMobileNavOpen} onOpenChange={onMobileNavOpenChange}>
      <a
        href='#main-content'
        className='bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none'
      >
        {t("a11y.skipToContent")}
      </a>
      <div
        className={cn("bg-background flex min-h-screen", className)}
        data-testid='appshell'
      >
        <div className='hidden md:flex'>
          <AppSidebar />
        </div>

        <SheetContent
          side='left'
          className='w-72 max-w-[80vw] p-0 sm:max-w-xs'
          showCloseButton={false}
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>{t("nav.menuTitle")}</SheetTitle>
          </SheetHeader>
          <AppSidebar onNavigate={closeMobileNav} className='w-full' />
        </SheetContent>

        <div className='flex min-w-0 flex-1 flex-col'>
          <header className='bg-background border-border sticky top-0 z-10 border-b'>
            <div className='flex h-16 items-center gap-3 px-4 lg:px-6'>
              <div className='flex items-center gap-3 md:hidden'>
                <SheetTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={t("nav.openMenu")}
                    onClick={openMobileNav}
                  >
                    <Menu className='h-5 w-5' aria-hidden='true' />
                  </Button>
                </SheetTrigger>
                <Link
                  to='/dashboard'
                  className='text-foreground flex items-center gap-2 text-base font-semibold tracking-tight'
                >
                  <span
                    aria-hidden='true'
                    className='bg-primary text-primary-foreground inline-flex h-7 w-7 items-center justify-center rounded-md'
                  >
                    <SquareTerminal className='h-4 w-4' strokeWidth={2.5} />
                  </span>
                  {t("app.name")}
                </Link>
              </div>

              {renderedDesktopPageHeader}

              <div className='ml-auto flex items-center gap-3'>
                <AccountSwitcher />
                <NotificationBell />
                <ThemeToggle />

                {displayName !== "" ? (
                  <span className='text-muted-foreground hidden text-sm md:inline'>
                    {displayName}
                  </span>
                ) : null}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  aria-busy={isLoggingOut}
                >
                  {isLoggingOut
                    ? t("auth.logout.confirming")
                    : t("auth.logout.button")}
                </Button>
              </div>
            </div>

            {renderedMobilePageHeader}
          </header>

          <main
            id='main-content'
            tabIndex={-1}
            className='flex-1 focus:outline-none'
          >
            {props.children}
          </main>
        </div>
      </div>
    </Sheet>
  );
};

AppShellFrame.displayName = "AppShellFrame";

const AppShell: FC<IAppShellProps> = (props) => (
  <AppPageHeaderProvider>
    <AppShellFrame {...props} />
  </AppPageHeaderProvider>
);

AppShell.displayName = "AppShell";

export default AppShell;
export { AppShell };
