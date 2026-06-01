import { createContext } from "react";

import type { IAppPageHeaderContextValue } from "./AppPage.types";

export const AppPageHeaderContext =
  createContext<IAppPageHeaderContextValue | null>(null);
