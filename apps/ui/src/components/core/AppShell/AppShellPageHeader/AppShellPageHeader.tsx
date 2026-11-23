import type { FC } from "react";

import { useAppShellPageHeader } from "./AppShellPageHeader.hooks";
import type { IAppShellPageHeaderProps } from "./AppShellPageHeader.types";

/* The page's title block in the shell's top bar: eyebrow, title and an optional line. */
const AppShellPageHeader: FC<IAppShellPageHeaderProps> = (props) => {
  const { eyebrow, subtitle, title } = props;
  const view = useAppShellPageHeader(props);

  return (
    <div className={view.className}>
      {eyebrow !== undefined ? (
        <span className={view.eyebrowClassName}>{eyebrow}</span>
      ) : null}
      <h1 className={view.titleClassName}>{title}</h1>
      {subtitle !== undefined ? (
        <p className={view.subtitleClassName}>{subtitle}</p>
      ) : null}
    </div>
  );
};

AppShellPageHeader.displayName = "AppShellPageHeader";

export default AppShellPageHeader;
export { AppShellPageHeader };
