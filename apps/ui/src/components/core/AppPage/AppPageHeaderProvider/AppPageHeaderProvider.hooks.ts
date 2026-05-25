import { useMemo, useState } from "react";

import type { IAppPageHeaderContextValue } from "../AppPage.types";
import type { IAppPageHeaderProviderProps } from "./AppPageHeaderProvider.types";

export function useAppPageHeaderProvider(): IAppPageHeaderProviderProps {
  const [header, setHeader] =
    useState<IAppPageHeaderContextValue["header"]>(null);
  const value = useMemo(
    () => ({
      header,
      setHeader
    }),
    [header]
  );

  return {
    contextValue: value
  };
}
