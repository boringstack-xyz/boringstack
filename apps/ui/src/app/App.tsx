import type { FC } from "react";

import { HelmetProvider } from "react-helmet-async";

import { AbilityProvider } from "./providers/AbilityProvider";
import { ErrorBoundaryProvider } from "./providers/ErrorBoundaryProvider";
import { I18nProvider } from "./providers/I18nProvider";
import { QueryProvider } from "./providers/QueryProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { AppRoutes } from "./router/routes";

export const App: FC = () => {
  return (
    <ErrorBoundaryProvider>
      <HelmetProvider>
        <I18nProvider>
          <QueryProvider>
            <AbilityProvider>
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </AbilityProvider>
          </QueryProvider>
        </I18nProvider>
      </HelmetProvider>
    </ErrorBoundaryProvider>
  );
};
