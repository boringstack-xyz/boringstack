import type { FC } from "react";

import { Helmet } from "react-helmet-async";

import { cn } from "@/lib/classnames";

import {
  APP_PAGE_CONTENT_CLASS_NAME,
  APP_PAGE_SHELL_CLASS_NAME
} from "./AppPage.constants";
import { useAppPage } from "./AppPage.hooks";
import type { IAppPageProps } from "./AppPage.types";

const AppPage: FC<IAppPageProps> = ({
  actions,
  children,
  className,
  contentClassName,
  eyebrow,
  pageTitle,
  subtitle,
  title
}) => {
  const { documentTitle } = useAppPage({
    actions,
    eyebrow,
    pageTitle,
    subtitle,
    title
  });

  return (
    <div className={cn(APP_PAGE_SHELL_CLASS_NAME, className)}>
      <Helmet>
        <title>{documentTitle}</title>
      </Helmet>

      <div className={cn(APP_PAGE_CONTENT_CLASS_NAME, contentClassName)}>
        {children}
      </div>
    </div>
  );
};

AppPage.displayName = "AppPage";

export default AppPage;
export { AppPage };
