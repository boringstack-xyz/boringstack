import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { type Resource, createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";

interface IProviderOptions {
  resources: Resource;
  language?: string;
  route?: string;
}

/** Explicit resources avoid importing the application's shared i18n singleton. */
export async function renderWithProviders(
  element: ReactElement,
  { resources, language = "en", route = "/" }: IProviderOptions
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
  const i18n = createInstance();

  await i18n.init({
    resources,
    lng: language,
    fallbackLng: language,
    defaultNS: "common",
    interpolation: { escapeValue: false }
  });
  const result = render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );

  return { ...result, client, i18n };
}
