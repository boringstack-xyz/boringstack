import { expect, test } from "vitest";

import { renderWithProviders } from "./render-with-providers";

test("each provider render has independent query and translation state", async () => {
  const first = await renderWithProviders(<span>first</span>, {
    resources: { en: { common: { label: "First" } } }
  });
  const second = await renderWithProviders(<span>second</span>, {
    resources: { en: { common: { label: "Second" } } }
  });

  try {
    first.client.setQueryData(["private"], "first account");
    expect(second.client.getQueryData(["private"])).toBeUndefined();
    expect(first.i18n.t("label")).toBe("First");
    expect(second.i18n.t("label")).toBe("Second");
  } finally {
    first.unmount();
    second.unmount();
    first.client.clear();
    second.client.clear();
  }
});
