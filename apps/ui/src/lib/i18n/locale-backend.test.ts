import { createInstance } from "i18next";
import { describe, expect, it, vi } from "vitest";

import { localeBackend } from "./locale-backend";
import enCommon from "./locales/en/common.json";

async function createTranslations() {
  const instance = createInstance();

  await instance.use(localeBackend).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["common"],
    defaultNS: "common",
    partialBundledLanguages: true,
    resources: { en: { common: enCommon } }
  });

  return instance;
}

describe("locale backend", () => {
  it("keeps secondary dictionaries unloaded until the language is requested", async () => {
    const instance = await createTranslations();

    expect(instance.hasResourceBundle("de", "common")).toBe(false);
    await instance.changeLanguage("de");
    expect(instance.hasResourceBundle("de", "common")).toBe(true);
    expect(instance.t("common.loading")).not.toBe("common.loading");
    expect(instance.t("common.loading")).not.toBe(enCommon.common.loading);
    await instance.changeLanguage("en");
    expect(instance.t("common.loading")).toBe(enCommon.common.loading);
  });

  it("retains the bundled fallback when a dictionary does not exist", async () => {
    const instance = await createTranslations();

    await instance.changeLanguage("missing-language");
    expect(instance.hasResourceBundle("missing-language", "common")).toBe(
      false
    );
    expect(instance.t("common.loading")).toBe(enCommon.common.loading);
  });

  it("reports an unknown namespace as a load failure", async () => {
    const instance = await createTranslations();

    const onFailure = vi.fn();

    instance.on("failedLoading", onFailure);
    await instance.loadNamespaces("missing-namespace");
    expect(onFailure).toHaveBeenCalledWith(
      "en",
      "missing-namespace",
      expect.any(Error)
    );
    expect(instance.hasResourceBundle("en", "missing-namespace")).toBe(false);
  });
});
