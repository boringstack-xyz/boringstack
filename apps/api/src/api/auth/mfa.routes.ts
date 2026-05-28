import { Elysia, t } from "elysia";

import {
  AUTH_COOKIE_CONFIG,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_CONFIG,
  REFRESH_COOKIE_NAME,
} from "../../lib/cookies";
import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import { buildJWTPayload, createJWTConfig } from "../../lib/jwt";
import { errorHandler } from "../../middleware/error-handler";
import { createAuthMiddleware } from "./auth.plugin";
import { AuthResponse, MessageResponse } from "./auth.schemas";
import { resolveActiveAccountId } from "./auth.utils";
import {
  MfaDisableRequestSchema,
  MfaRecoveryCodesResponse,
  MfaRegenerateRequestSchema,
  MfaSetupRequestSchema,
  MfaSetupResponse,
  MfaVerifyLoginRequestSchema,
  MfaVerifySetupRequestSchema,
} from "./mfa.schemas";
import { mfaService, sessionService } from "./services";

/*
 * Session-cookie issuance is inlined per handler below (mirrors the
 * pattern in auth.routes.ts). The Elysia jwt plugin type is nominal so
 * pulling it into a shared helper would force a re-quote of the plugin
 * shape; the duplicated five lines are cheaper.
 */

/**
 * Unauthenticated MFA endpoints. The opaque challenge token in the body
 * authenticates the request — the session cookie is not yet issued at
 * this point in the flow.
 */
const mfaUnauthenticatedRoutes = new Elysia()
  .use(createJWTConfig())
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/mfa/verify-login",
    async ({ body, jwt, cookie }) => {
      const outcome = await mfaService.verifyTotpLogin(
        body.challengeToken,
        body.code
      );

      if (outcome.kind === "failed") {
        throw ApiErrors.unauthorized(
          `Invalid code. ${String(outcome.attemptsRemaining)} attempts left.`
        );
      }

      if (outcome.kind === "locked_out") {
        throw ApiErrors.unauthorized(
          "Too many failed attempts. Sign in again to retry."
        );
      }

      const session = await sessionService.create(outcome.user.id);
      const accountId = await resolveActiveAccountId(outcome.user.id);
      const token = await jwt.sign(
        buildJWTPayload(outcome.user.id, outcome.user.email, accountId)
      );

      cookie[AUTH_COOKIE_NAME]?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      cookie[REFRESH_COOKIE_NAME]?.set({
        value: session.token,
        ...REFRESH_COOKIE_CONFIG,
      });

      return createSuccessResponse({ user: outcome.user });
    },
    {
      body: MfaVerifyLoginRequestSchema,
      response: AuthResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Complete MFA challenge with a TOTP code",
      },
    }
  )
  .post(
    "/mfa/verify-recovery",
    async ({ body, jwt, cookie }) => {
      const outcome = await mfaService.verifyRecoveryLogin(
        body.challengeToken,
        body.code
      );

      if (outcome.kind === "failed") {
        throw ApiErrors.unauthorized(
          `Invalid recovery code. ${String(outcome.attemptsRemaining)} attempts left.`
        );
      }

      if (outcome.kind === "locked_out") {
        throw ApiErrors.unauthorized(
          "Too many failed attempts. Sign in again to retry."
        );
      }

      const session = await sessionService.create(outcome.user.id);
      const accountId = await resolveActiveAccountId(outcome.user.id);
      const token = await jwt.sign(
        buildJWTPayload(outcome.user.id, outcome.user.email, accountId)
      );

      cookie[AUTH_COOKIE_NAME]?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      cookie[REFRESH_COOKIE_NAME]?.set({
        value: session.token,
        ...REFRESH_COOKIE_CONFIG,
      });

      return createSuccessResponse({ user: outcome.user });
    },
    {
      body: MfaVerifyLoginRequestSchema,
      response: AuthResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Complete MFA challenge with a recovery code",
      },
    }
  );

/**
 * Authenticated MFA endpoints. Every route requires a valid session
 * cookie; sensitive routes additionally take the password in the body
 * as step-up auth (see `mfaService.assertPasswordValid`).
 */
const mfaAuthenticatedRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get(
    "/mfa/status",
    ({ user }) =>
      createSuccessResponse({
        enabled: user.mfaEnabledAt !== null,
      }),
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Object({ enabled: t.Boolean() }),
        timestamp: t.String(),
      }),
      detail: {
        tags: ["Authentication"],
        summary: "Report whether MFA is currently enabled for the user",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/mfa/setup",
    async ({ body, user }) =>
      createSuccessResponse(await mfaService.setup(user.id, body.password)),
    {
      body: MfaSetupRequestSchema,
      response: MfaSetupResponse,
      detail: {
        tags: ["Authentication"],
        summary:
          "Stage a TOTP secret + recovery codes. Returns the otpauth URI and the codes (shown once).",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/mfa/verify-setup",
    async ({ body, user }) => {
      await mfaService.verifySetup(user.id, body.code);

      return createSuccessResponse({ message: "MFA enabled" });
    },
    {
      body: MfaVerifySetupRequestSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Verify the first TOTP code and finalize enrollment",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/mfa/disable",
    async ({ body, user }) => {
      await mfaService.disable(user.id, body.password);

      return createSuccessResponse({ message: "MFA disabled" });
    },
    {
      body: MfaDisableRequestSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Disable MFA after password step-up",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .post(
    "/mfa/regenerate-recovery-codes",
    async ({ body, user }) =>
      createSuccessResponse(
        await mfaService.regenerateRecoveryCodes(user.id, body.password)
      ),
    {
      body: MfaRegenerateRequestSchema,
      response: MfaRecoveryCodesResponse,
      detail: {
        tags: ["Authentication"],
        summary:
          "Replace all recovery codes after password step-up. Returns the new codes once.",
        security: [{ cookieAuth: [] }],
      },
    }
  );

const mfaRoutes = new Elysia()
  .use(mfaUnauthenticatedRoutes)
  .use(mfaAuthenticatedRoutes);

export default mfaRoutes;
