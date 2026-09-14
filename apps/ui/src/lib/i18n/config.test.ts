import { expect, test, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { VITE_LOCALES: ["en", "de"] }
}));

test("application configuration does not preload secondary locale resources", async () => {
  localStorage.setItem("i18nextLng", "en");
  const { i18n } = await import("./config");

  try {
    await i18n.changeLanguage("en");
    expect(i18n.hasResourceBundle("en", "common")).toBe(true);
    expect(i18n.hasResourceBundle("de", "common")).toBe(false);
    const english = i18n.t("common.loading");

    await i18n.changeLanguage("de");
    expect(i18n.hasResourceBundle("de", "common")).toBe(true);
    expect(i18n.t("common.loading")).not.toBe(english);
    expect(i18n.t("common.loading")).not.toBe("common.loading");
  } finally {
    await i18n.changeLanguage("en");
    localStorage.removeItem("i18nextLng");
  }
});
