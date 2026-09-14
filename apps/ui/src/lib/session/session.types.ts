import type { operations } from "@/lib/api/client";

/*
 * /api/v1/users/me is a probe endpoint: it returns `{ user: null }` for
 * anonymous callers and the full session payload otherwise. The shape is
 * pulled from the OpenAPI operation rather than restated in Zod because
 * the server owns the contract. `IMe` extracts the authenticated branch;
 * the `null` branch is handled at the query layer (see `useMe`).
 */
type MeResponse =
  operations["getApiV1UsersMe"]["responses"][200]["content"]["application/json"];

export type IMe = Extract<MeResponse, { user: object }>;
export type IMembershipSummary = IMe["memberships"][number];
export type IResolvedFeatures = IMe["features"];
