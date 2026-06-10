import type { FC, ReactNode } from "react";

import { useAppPageHeader } from "@/components/core/AppPage/AppPageHeader.hooks";
import { AppPageHeaderProvider } from "@/components/core/AppPage/AppPageHeaderProvider";

const AppPageHeaderTestProbe: FC = () => {
  const header = useAppPageHeader();

  if (header === null) {
    return null;
  }

  return (
    <header data-testid='app-page-test-header'>
      <h1>{header.title}</h1>
      {header.subtitle !== undefined ? <p>{header.subtitle}</p> : null}
      {header.actions ?? null}
    </header>
  );
};

AppPageHeaderTestProbe.displayName = "AppPageHeaderTestProbe";

const AppPageTestShell: FC<{ readonly children: ReactNode }> = ({
  children
}) => (
  <AppPageHeaderProvider>
    <AppPageHeaderTestProbe />
    {children}
  </AppPageHeaderProvider>
);

AppPageTestShell.displayName = "AppPageTestShell";

export { AppPageTestShell };
