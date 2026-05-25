/**
 * The single source of HTTP truth for the UI.
 *
 *   import { apiClient } from "@/lib/api/client";
 *   const { data } = await apiClient.GET("/api/v1/users/me");
 *   //      ^? typed from src/lib/api/schema.d.ts (regenerated via `pnpm generate:api`)
 *
 * On non-2xx responses an `ApiError` is thrown (see ./openapi.ts middleware).
 * Lint forbids any other module from calling `fetch` / `axios` directly.
 */
export { openapi as apiClient } from "./openapi";
export type { paths, components, operations } from "./schema";
