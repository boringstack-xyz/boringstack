import { useContext } from "react";

import type {
  IAppPageHeaderContextValue,
  IAppPageHeaderState
} from "./AppPage.types";
import { AppPageHeaderContext } from "./AppPageHeader.context";

export function useAppPageHeaderContext(): IAppPageHeaderContextValue | null {
  return useContext(AppPageHeaderContext);
}

export function useAppPageHeader(): IAppPageHeaderState | null {
  return useAppPageHeaderContext()?.header ?? null;
}
