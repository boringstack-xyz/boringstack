import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { env } from "@/lib/env";

import deCommon from "./locales/de/common.json";
import enCommon from "./locales/en/common.json";

const supportedLngs = env.VITE_LOCALES;
const fallbackLng = supportedLngs[0] ?? "en";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      de: { common: deCommon }
    },
    fallbackLng,
    supportedLngs,
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });

export { i18n };
