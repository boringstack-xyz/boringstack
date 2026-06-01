import type { FC, PropsWithChildren } from "react";

import { I18nextProvider } from "react-i18next";

import { i18n } from "@/lib/i18n/config";

export const I18nProvider: FC<PropsWithChildren> = ({ children }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
