import type { FC, PropsWithChildren } from "react";
import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { env } from "@/lib/env";

import { isDevtoolsRequested } from "./QueryProvider.devtools";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: 0
      }
    }
  });
}

export const QueryProvider: FC<PropsWithChildren> = ({ children }) => {
  const [client] = useState(makeQueryClient);
  /*
   * The devtools panel floats over app controls, so it is opt-in: `?devtools`
   * in dev. `env.DEV &&` keeps the production build free of the panel.
   */
  const [showDevtools] = useState(isDevtoolsRequested);

  return (
    <QueryClientProvider client={client}>
      {children}
      {env.DEV && showDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
};
