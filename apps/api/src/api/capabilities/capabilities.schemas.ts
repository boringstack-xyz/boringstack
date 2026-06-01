import { t } from "elysia";

const OAuthProviderSchema = t.Union([
  t.Literal("google"),
  t.Literal("github"),
  t.Literal("linkedin"),
]);

export const CapabilitiesResponseSchema = t.Object({
  features: t.Object({
    notifications: t.Object({
      sse: t.Boolean(),
      webPush: t.Boolean(),
    }),
    billing: t.Object({
      enabled: t.Boolean(),
    }),
    ai: t.Object({
      enabled: t.Boolean(),
    }),
  }),
  oauth: t.Object({
    providers: t.Array(OAuthProviderSchema),
  }),
});
