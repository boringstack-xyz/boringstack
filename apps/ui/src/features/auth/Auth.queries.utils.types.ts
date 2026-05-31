import type { ApiError } from "@/lib/api/ApiError";

import type { IMe } from "./Auth.types";

/*
 * Discriminated state used by `ProtectedRoute` (via `resolveAuthStatus`
 * in `Auth.queries.utils.ts`) to map a TanStack Query result for
 * `useMe` to one of four mutually exclusive outcomes. Keeping the
 * union open-coded here means the consumer never has to restate the
 * branching at the callsite.
 */
export type AuthStatus =
  | { kind: "authed"; me: IMe }
  | { kind: "anonymous" }
  | { kind: "offline"; error: unknown }
  | { kind: "unauthorized"; error: ApiError };
