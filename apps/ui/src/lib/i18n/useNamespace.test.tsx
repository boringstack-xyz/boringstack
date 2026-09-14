import type { PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { useNamespace } from "./useNamespace";

async function createWrapper(language: string) {
  const instance = createInstance();

  await instance.init({
    lng: language,
    fallbackLng: "en",
    resources: { en: { feature: { title: "Translated heading" } } },
    react: { useSuspense: false }
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
  };
}

describe("useNamespace", () => {
  it("returns the loaded dictionary", async () => {
    const wrapper = await createWrapper("en");
    const { result } = renderHook(() => useNamespace("feature"), { wrapper });

    expect(result.current.t("title")).toBe("Translated heading");
  });

  it("allows a loaded fallback when the selected language is missing", async () => {
    const wrapper = await createWrapper("de");
    const { result } = renderHook(() => useNamespace("feature"), { wrapper });

    expect(result.current.t("title")).toBe("Translated heading");
  });

  it("throws when no usable dictionary exists", async () => {
    const wrapper = await createWrapper("en");

    expect(() =>
      renderHook(() => useNamespace("missing"), { wrapper })
    ).toThrow("Translation namespace unavailable: missing");
  });
});
