export type AuthJWTPayloadResult =
  | { kind: "ok"; userId: string; accountId: string }
  | { kind: "invalid" };
