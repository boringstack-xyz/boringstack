import { Elysia, t } from "elysia";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { buildAuthRateLimit } from "../../config/security";
import {
  AUTH_COOKIE_CONFIG,
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_CONFIG,
  REFRESH_COOKIE_NAME,
} from "../../lib/cookies";
import { ApiErrors, createSuccessResponse } from "../../lib/errors";
import {
  buildJWTPayload,
  createJWTConfig,
  jwtRevocationService,
  parseAuthJWTPayload,
} from "../../lib/jwt";
import { emailRateLimiter } from "../../lib/rate-limit/email-rate-limit";
import {
  completeOAuthCallback,
  createAuthorizationURL,
  DEFAULT_OAUTH_SCOPES,
  isValidOAuthProvider,
} from "../../lib/oauth";
import { now } from "../../lib/time/now";
import { errorHandler } from "../../middleware/error-handler";
import { createAuthMiddleware } from "./auth.plugin";
import {
  AuthResponse,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  MessageResponse,
  RegisterSchema,
  ResendVerificationSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "./auth.schemas";
import { resolveActiveAccountId } from "./auth.utils";
import mfaRoutes from "./mfa.routes";
import { MfaRequiredResponse } from "./mfa.schemas";
import {
  authService,
  emailVerificationService,
  mfaService,
  oauthAuthService,
  passwordChangeService,
  passwordResetService,
  sessionService,
} from "./services";

const credentialingRoutes = new Elysia()
  .use(buildAuthRateLimit())
  .use(createJWTConfig())
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/register",
    async ({ body }) => {
      if (!emailRateLimiter.check(body.email)) {
        throw ApiErrors.validation(
          "Too many registration attempts for this email. Please wait a few minutes.",
          "email"
        );
      }

      const result = await authService.register(body);

      return createSuccessResponse({
        message: `Verification email sent to ${result.email}`,
      });
    },
    {
      body: RegisterSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary:
          "Register a new user. No account or session is issued; the user must click the verification email link to activate.",
      },
    }
  )
  .post(
    "/login",
    async ({ body, jwt, cookie }) => {
      const result = await authService.login(body);

      if (result.mfaRequired) {
        /*
         * Password ok but the user has MFA enabled — issue a short-lived
         * opaque challenge instead of the session cookies. The SPA
         * exchanges this for a real session via /auth/mfa/verify-login
         * (or /auth/mfa/verify-recovery). Cookies stay unset on purpose
         * so a leaked challenge can't grant API access on its own.
         */
        const challenge = await mfaService.issueChallenge(result.userId);

        return createSuccessResponse({
          mfaRequired: true as const,
          challengeToken: challenge.challengeToken,
        });
      }

      const accountId = await resolveActiveAccountId(result.user.id);
      const session = await sessionService.create(result.user.id);
      const token = await jwt.sign(
        buildJWTPayload(result.user.id, result.user.email, accountId)
      );

      const auth = cookie[AUTH_COOKIE_NAME];
      const refresh = cookie[REFRESH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      refresh?.set({ value: session.token, ...REFRESH_COOKIE_CONFIG });

      return createSuccessResponse({ user: result.user });
    },
    {
      body: LoginSchema,
      response: t.Union([AuthResponse, MfaRequiredResponse]),
      detail: { tags: ["Authentication"], summary: "Log in" },
    }
  )
  .post(
    "/verify-email",
    async ({ body, jwt, cookie }) => {
      const result = await emailVerificationService.verify(body.token);
      const session = await sessionService.create(result.user.id);
      const token = await jwt.sign(
        buildJWTPayload(result.user.id, result.user.email, result.accountId)
      );

      const auth = cookie[AUTH_COOKIE_NAME];
      const refresh = cookie[REFRESH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      refresh?.set({ value: session.token, ...REFRESH_COOKIE_CONFIG });

      return createSuccessResponse({ user: result.user });
    },
    {
      body: VerifyEmailSchema,
      response: AuthResponse,
      detail: {
        tags: ["Authentication"],
        summary:
          "Verify email + provision personal account. Issues session cookies on success.",
      },
    }
  )
  .post(
    "/resend-verification",
    async ({ body }) => {
      if (!emailRateLimiter.check(body.email)) {
        throw ApiErrors.validation(
          "Too many verification emails requested. Please wait a few minutes.",
          "email"
        );
      }

      return createSuccessResponse(
        await emailVerificationService.resend(body.email)
      );
    },
    {
      body: ResendVerificationSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Resend verification email",
      },
    }
  )
  .post(
    "/__test/force-verify",
    async ({ body, jwt, cookie, set }) => {
      if (env.NODE_ENV !== "test" && !env.E2E_TEST_ENDPOINTS_ENABLED) {
        set.status = 404;

        return {
          success: false as const,
          error: {
            code: "NOT_FOUND",
            message: "Resource not found",
            timestamp: now(),
          },
        };
      }

      const result = await emailVerificationService.forceVerifyForTests(
        body.email
      );
      const session = await sessionService.create(result.user.id);
      const token = await jwt.sign(
        buildJWTPayload(result.user.id, result.user.email, result.accountId)
      );

      const auth = cookie[AUTH_COOKIE_NAME];
      const refresh = cookie[REFRESH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      refresh?.set({ value: session.token, ...REFRESH_COOKIE_CONFIG });

      return createSuccessResponse({ user: result.user });
    },
    {
      body: t.Object({ email: t.String({ format: "email" }) }),
      response: t.Union([
        AuthResponse,
        t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String(),
            timestamp: t.String(),
          }),
        }),
      ]),
      detail: {
        tags: ["Authentication"],
        summary:
          "TEST ONLY — force-verify a user + provision account + issue session. Returns 404 unless NODE_ENV=test or E2E_TEST_ENDPOINTS_ENABLED=true.",
      },
    }
  )
  .post(
    "/__test/issue-reset-token",
    async ({ body, set }) => {
      if (env.NODE_ENV !== "test" && !env.E2E_TEST_ENDPOINTS_ENABLED) {
        set.status = 404;

        return {
          success: false as const,
          error: {
            code: "NOT_FOUND",
            message: "Resource not found",
            timestamp: now(),
          },
        };
      }

      const issued = await passwordResetService.issueRawTokenForTests(
        body.email
      );

      if (issued === null) {
        throw ApiErrors.notFound("User");
      }

      return createSuccessResponse(issued);
    },
    {
      body: t.Object({ email: t.String({ format: "email" }) }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          data: t.Object({
            token: t.String(),
            expiresAt: t.String(),
          }),
          timestamp: t.String(),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.Object({
            code: t.String(),
            message: t.String(),
            timestamp: t.String(),
          }),
        }),
      ]),
      detail: {
        tags: ["Authentication"],
        summary:
          "TEST ONLY — issue a raw password-reset token bypassing email. Returns 404 unless NODE_ENV=test or E2E_TEST_ENDPOINTS_ENABLED=true.",
      },
    }
  )
  .post(
    "/forgot-password",
    async ({ body }) => {
      if (!emailRateLimiter.check(body.email)) {
        throw ApiErrors.validation(
          "Too many password reset requests. Please wait a few minutes.",
          "email"
        );
      }

      return createSuccessResponse(
        await passwordResetService.request(body.email)
      );
    },
    {
      body: ForgotPasswordSchema,
      response: MessageResponse,
      detail: { tags: ["Authentication"], summary: "Request password reset" },
    }
  )
  .post(
    "/reset-password",
    async ({ body }) =>
      createSuccessResponse(
        await passwordResetService.complete(body.token, body.password)
      ),
    {
      body: ResetPasswordSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Reset password with token",
      },
    }
  );

const sessionAndOAuthRoutes = new Elysia()
  .use(createJWTConfig())
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/logout",
    async ({ jwt, cookie }) => {
      const auth = cookie[AUTH_COOKIE_NAME];
      const refresh = cookie[REFRESH_COOKIE_NAME];
      const refreshValue = refresh?.value;

      if (typeof refreshValue === "string") {
        await sessionService.revoke(refreshValue);
      }

      /*
       * Best-effort access-token revocation: parse the JWT cookie,
       * pull jti + exp, mark it dead in cache for its remaining life.
       * Failures (missing cookie, expired token, decode error) are
       * swallowed — the cookies are still removed below, so the user
       * is logged out as far as the browser is concerned.
       */
      const authValue = auth?.value;

      if (typeof authValue === "string" && authValue !== "") {
        try {
          const verified = await jwt.verify(authValue);
          const parsed = parseAuthJWTPayload(verified);

          if (
            parsed.kind === "ok" &&
            parsed.jti !== null &&
            verified !== false &&
            typeof verified === "object" &&
            "exp" in verified &&
            typeof verified.exp === "number"
          ) {
            await jwtRevocationService.revokeJti(parsed.jti, verified.exp);
          }
        } catch {
          // intentional: revocation is opportunistic on logout.
        }
      }

      auth?.remove();
      refresh?.remove();

      return createSuccessResponse({ message: "Logged out" });
    },
    {
      response: MessageResponse,
      detail: { tags: ["Authentication"], summary: "Log out" },
    }
  )
  .post(
    "/refresh",
    async ({ jwt, cookie }) => {
      const refresh = cookie[REFRESH_COOKIE_NAME];
      const refreshValue = refresh?.value;

      if (typeof refreshValue !== "string" || refreshValue === "") {
        throw ApiErrors.unauthorized("Missing refresh session");
      }

      const result = await sessionService.refresh(refreshValue);
      const accountId = await resolveActiveAccountId(result.user.id);
      const token = await jwt.sign(
        buildJWTPayload(result.user.id, result.user.email, accountId)
      );

      const auth = cookie[AUTH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      refresh?.set({ value: result.token, ...REFRESH_COOKIE_CONFIG });

      return createSuccessResponse({ user: result.user });
    },
    {
      response: AuthResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Refresh the auth cookie using the refresh session",
      },
    }
  )
  .get(
    "/oauth/:provider",
    async ({ params, redirect }) => {
      if (!isValidOAuthProvider(params.provider)) {
        throw ApiErrors.notFound(`OAuth provider '${params.provider}'`);
      }

      const { url } = await createAuthorizationURL(params.provider, [
        ...DEFAULT_OAUTH_SCOPES[params.provider],
      ]);

      return redirect(url.toString(), 302);
    },
    {
      params: t.Object({ provider: t.String() }),
      detail: {
        tags: ["Authentication"],
        summary: "Start OAuth login (redirects to provider)",
      },
    }
  )
  .get(
    "/oauth/:provider/callback",
    async ({ params, query, jwt, cookie, redirect }) => {
      if (!isValidOAuthProvider(params.provider)) {
        throw ApiErrors.notFound(`OAuth provider '${params.provider}'`);
      }

      if (typeof query.error === "string" && query.error !== "") {
        /*
         * Map provider error strings to a closed set before forwarding
         * to the SPA. The raw value can contain provider-specific detail
         * (IdP internals, allowlist hints) that we don't want on the
         * client URL bar. The SPA only needs to distinguish "user
         * cancelled" from "everything else" for its toast copy; the
         * forensic detail stays in our logs.
         */
        const RFC6749_ERRORS = new Set([
          "access_denied",
          "invalid_request",
          "unauthorized_client",
          "unsupported_response_type",
          "invalid_scope",
          "server_error",
          "temporarily_unavailable",
        ]);
        const safeError = RFC6749_ERRORS.has(query.error)
          ? query.error
          : "provider_error";

        logger.warn("OAuth callback returned provider error", {
          event: "oauth.callback.provider_error",
          provider: params.provider,
          rawError: query.error,
          mappedError: safeError,
        });

        return redirect(
          `${env.FRONTEND_URL}/oauth/success?error=${safeError}`,
          302
        );
      }

      if (typeof query.code !== "string" || query.code === "") {
        throw ApiErrors.validation("Missing OAuth authorization code", "code");
      }

      if (typeof query.state !== "string" || query.state === "") {
        throw ApiErrors.validation("Missing OAuth state", "state");
      }

      const { profile, linkUserId } = await completeOAuthCallback(
        params.provider,
        query.code,
        query.state
      );

      if (linkUserId !== undefined) {
        await oauthAuthService.linkProviderFromProfile(
          linkUserId,
          params.provider,
          profile
        );

        return redirect(
          `${env.FRONTEND_URL}/account/settings?oauth=linked`,
          302
        );
      }

      const result = await oauthAuthService.loginOrRegisterFromProfile(
        params.provider,
        profile
      );
      const session = await sessionService.create(result.user.id);

      const token = await jwt.sign(
        buildJWTPayload(result.user.id, result.user.email, result.accountId)
      );

      const auth = cookie[AUTH_COOKIE_NAME];
      const refresh = cookie[REFRESH_COOKIE_NAME];

      auth?.set({ value: token, ...AUTH_COOKIE_CONFIG });
      refresh?.set({ value: session.token, ...REFRESH_COOKIE_CONFIG });

      /*
       * Hand the browser back to the SPA. Apps can override the success
       * path with the existing FRONTEND_URL env var.
       */
      return redirect(`${env.FRONTEND_URL}/oauth/success`, 302);
    },
    {
      params: t.Object({ provider: t.String() }),
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Authentication"],
        summary: "OAuth callback — exchanges code, sets auth cookie",
      },
    }
  );

const authenticatedAuthRoutes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .post(
    "/change-password",
    async ({ body, user }) =>
      createSuccessResponse(
        await passwordChangeService.change(
          user.id,
          body.currentPassword,
          body.newPassword
        )
      ),
    {
      body: ChangePasswordSchema,
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Change password while authenticated",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/oauth/:provider/link",
    async ({ params, user, redirect }) => {
      if (!isValidOAuthProvider(params.provider)) {
        throw ApiErrors.notFound(`OAuth provider '${params.provider}'`);
      }

      const { url } = await createAuthorizationURL(
        params.provider,
        [...DEFAULT_OAUTH_SCOPES[params.provider]],
        { linkUserId: user.id }
      );

      return redirect(url.toString(), 302);
    },
    {
      params: t.Object({ provider: t.String() }),
      detail: {
        tags: ["Authentication"],
        summary: "Link an OAuth provider to the current user",
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/oauth/:provider",
    async ({ params, user }) => {
      if (!isValidOAuthProvider(params.provider)) {
        throw ApiErrors.notFound(`OAuth provider '${params.provider}'`);
      }

      await oauthAuthService.disconnectProvider(user.id, params.provider);

      return createSuccessResponse({ message: "Provider disconnected" });
    },
    {
      params: t.Object({ provider: t.String() }),
      response: MessageResponse,
      detail: {
        tags: ["Authentication"],
        summary: "Disconnect an OAuth provider from the current user",
        security: [{ cookieAuth: [] }],
      },
    }
  );

const authRoutes = new Elysia()
  .use(credentialingRoutes)
  .use(sessionAndOAuthRoutes)
  .use(authenticatedAuthRoutes)
  .use(mfaRoutes);

export default authRoutes;
