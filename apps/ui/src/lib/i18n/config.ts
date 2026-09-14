import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { env } from "@/lib/env";

import { localeBackend } from "./locale-backend";
import enCommon from "./locales/en/common.json";

const supportedLngs = env.VITE_LOCALES;
const fallbackLng = supportedLngs[0] ?? "en";

void i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon }
    },
    fallbackLng: [fallbackLng, "en"],
    partialBundledLanguages: true,
    supportedLngs,
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: true }
  });

export { i18n };
