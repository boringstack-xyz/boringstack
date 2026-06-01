import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type {
  INotificationEvent,
  INotificationEventDefinition,
  IEventRenderContext,
  IRegisteredEvent,
} from "../notifications.types";

/**
 * Type-erasure boundary for notification event definitions. Author-facing
 * handlers (`selfActionGuard`, `dedup.key`, `render.inApp`, `render.email.*`)
 * receive a fully-typed payload (`Static<TSchemaShape>`); the runtime
 * stored shape is `IRegisteredEvent` whose handlers take `unknown`.
 *
 * `Value.Cast` bridges the two without any TypeScript `as` assertions:
 * its declared return type IS `Static<S>`, so passing it into the user's
 * typed function compiles cleanly. At runtime the dispatcher has already
 * validated the payload against the same schema, so Cast acts as identity
 * + light defaulting (effectively free on validated input).
 */
export const defineNotificationEvent = <TSchemaShape extends TSchema>(
  definition: INotificationEventDefinition<Static<TSchemaShape>, TSchemaShape>
): INotificationEvent<Static<TSchemaShape>> => {
  const schema = definition.schema;
  const userSelfActionGuard = definition.selfActionGuard;
  const userDedup = definition.dedup;
  const userRenderInApp = definition.render.inApp;
  const userRenderEmail = definition.render.email;

  const erased: IRegisteredEvent = {
    type: definition.type,
    schema,
    defaultChannels: definition.defaultChannels,
    dedup: userDedup
      ? {
          key: (ctx: IEventRenderContext<unknown>): string =>
            userDedup.key({
              recipientUserId: ctx.recipientUserId,
              payload: Value.Cast(schema, ctx.payload),
            }),
          windowSeconds: userDedup.windowSeconds,
        }
      : undefined,
    selfActionGuard: userSelfActionGuard
      ? (ctx: IEventRenderContext<unknown>): boolean =>
          userSelfActionGuard({
            recipientUserId: ctx.recipientUserId,
            payload: Value.Cast(schema, ctx.payload),
          })
      : undefined,
    render: {
      inApp: userRenderInApp
        ? (ctx: IEventRenderContext<unknown>) =>
            userRenderInApp({
              recipientUserId: ctx.recipientUserId,
              payload: Value.Cast(schema, ctx.payload),
            })
        : undefined,
      email: userRenderEmail
        ? {
            subject: (ctx: IEventRenderContext<unknown>): string =>
              userRenderEmail.subject({
                recipientUserId: ctx.recipientUserId,
                payload: Value.Cast(schema, ctx.payload),
              }),
            templatePath: userRenderEmail.templatePath,
            variables: userRenderEmail.variables
              ? (
                  ctx: IEventRenderContext<unknown>
                ): Record<string, unknown> => {
                  const userVariables = userRenderEmail.variables;

                  if (userVariables === undefined) {
                    return {};
                  }

                  return userVariables({
                    recipientUserId: ctx.recipientUserId,
                    payload: Value.Cast(schema, ctx.payload),
                  });
                }
              : undefined,
          }
        : undefined,
    },
  };

  /*
   * The phantom payload brand is type-only — adding it returns the
   * intersection `IRegisteredEvent & IPayloadBrand<TPayload>` without
   * introducing any runtime field, since `__payload` is optional.
   */
  return erased;
};
