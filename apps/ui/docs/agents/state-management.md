# State management

Read when picking where new state lives, or wiring a query / store.

## The grid

| State kind                        | Where it lives                                            |
| --------------------------------- | --------------------------------------------------------- |
| Server state (data from the API)  | `*.queries.ts` — TanStack Query                           |
| Cross-page UI state (theme, etc.) | `src/store/*.store.ts` — Zustand                          |
| Feature-scoped client state       | `<feature>/<Feature>.store.ts` — Zustand                  |
| Component-local state             | Inside `<Component>.hooks.ts` — `useState` / `useReducer` |
| Form state                        | `useForm` (react-hook-form) inside `<Component>.hooks.ts` |

Server state and client state never live in the same store. TanStack
Query _is_ the server cache. Lift to Zustand only when the same
piece of state is read by multiple unrelated routes or features.
The `AppShell` mobile-nav open/close, for example, is purely local
to `useAppShell` — there is no Zustand store for it.

## Queries

```ts
// src/features/tickets/Tickets.queries.ts
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

import { TICKETS_QUERY_KEYS } from "./Tickets.constants";

export function useTickets() {
  return useQuery({
    queryKey: TICKETS_QUERY_KEYS.list,
    queryFn: async () => {
      const { data } = await apiClient.GET("/api/tickets");

      return data ?? [];
    }
  });
}
```

Query keys live in `*.constants.ts` to keep cache-invalidation
atomic.

## Mutations

```ts
const qc = useQueryClient();
return useMutation({
  mutationFn: (input: ICreateTicket) =>
    apiClient.POST("/api/tickets", { body: input }),
  onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_QUERY_KEYS.list })
});
```

## Stores

Reach for Zustand only when the state is shared across routes that
don't share a parent component. Theme preference is the canonical
example — every page reads it; no single component owns it.

```ts
// src/store/theme.store.ts
import { create } from "zustand";

interface IThemeState {
  theme: "light" | "dark";
  setTheme: (next: "light" | "dark") => void;
}

export const useThemeStore = create<IThemeState>((set) => ({
  theme: "light",
  setTheme: (next) => set({ theme: next })
}));
```

Selectors should be granular — `useThemeStore((s) => s.theme)` —
not the whole store. Subscribing to the whole store re-renders the
component on every unrelated change.
