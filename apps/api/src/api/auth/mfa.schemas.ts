import { t } from "elysia";

const PasswordSchema = t.String({
  minLength: 1,
  description: "Current password — step-up authentication",
});

const TotpCodeSchema = t.String({
  minLength: 6,
  maxLength: 10,
  description: "6-digit TOTP code or recovery code",
});

const ChallengeTokenSchema = t.String({
  minLength: 16,
  maxLength: 255,
  description: "Opaque token returned by /auth/login when MFA is required",
});

export const MfaSetupRequestSchema = t.Object({
  password: PasswordSchema,
});

export const MfaSetupResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    otpauthUri: t.String(),
    secretBase32: t.String(),
    recoveryCodes: t.Array(t.String()),
  }),
  timestamp: t.String(),
});

export const MfaVerifySetupRequestSchema = t.Object({
  code: TotpCodeSchema,
});

export const MfaVerifyLoginRequestSchema = t.Object({
  challengeToken: ChallengeTokenSchema,
  code: TotpCodeSchema,
});

export const MfaRecoveryCodesResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    recoveryCodes: t.Array(t.String()),
  }),
  timestamp: t.String(),
});

export const MfaDisableRequestSchema = t.Object({
  password: PasswordSchema,
});

export const MfaRegenerateRequestSchema = t.Object({
  password: PasswordSchema,
});

/**
 * `/auth/login` response when MFA is required. The success-true union
 * variant alongside `AuthResponse`: route returns one or the other.
 */
export const MfaRequiredResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    mfaRequired: t.Literal(true),
    challengeToken: t.String(),
  }),
  timestamp: t.String(),
});
