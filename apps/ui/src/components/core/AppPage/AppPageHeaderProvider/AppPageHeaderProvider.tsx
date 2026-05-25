import type { FC, ReactNode } from "react";

import { AppPageHeaderContext } from "../AppPageHeader.context";
import { useAppPageHeaderProvider } from "./AppPageHeaderProvider.hooks";

const AppPageHeaderProvider: FC<{ readonly children: ReactNode }> = ({
  children
}) => {
  const { contextValue } = useAppPageHeaderProvider();

  return (
    <AppPageHeaderContext.Provider value={contextValue}>
      {children}
    </AppPageHeaderContext.Provider>
  );
};

AppPageHeaderProvider.displayName = "AppPageHeaderProvider";

export default AppPageHeaderProvider;
export { AppPageHeaderProvider };
