import type { z } from "zod";

import type { operations } from "@/lib/api/client";

import type {
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  loginResponseSchema,
  mfaPasswordInputSchema,
  mfaRecoveryCodesResponseSchema,
  mfaSetupInputSchema,
  mfaSetupResponseSchema,
  mfaStatusResponseSchema,
  mfaVerifyChallengeInputSchema,
  mfaVerifySetupInputSchema,
  registerInputSchema,
  resendVerificationInputSchema,
  resetPasswordInputSchema,
  updateProfileInputSchema,
  userSchema,
  verifyEmailInputSchema
} from "./Auth.schemas";

export type ILoginInput = z.infer<typeof loginInputSchema>;
export type ILoginResponse = z.infer<typeof loginResponseSchema>;
export type IRegisterInput = z.infer<typeof registerInputSchema>;
export type IVerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type IResendVerificationInput = z.infer<
  typeof resendVerificationInputSchema
>;
export type IUpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type IForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type IResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type IChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type IUser = z.infer<typeof userSchema>;

export type IMfaSetupInput = z.infer<typeof mfaSetupInputSchema>;
export type IMfaVerifySetupInput = z.infer<typeof mfaVerifySetupInputSchema>;
export type IMfaVerifyChallengeInput = z.infer<
  typeof mfaVerifyChallengeInputSchema
>;
export type IMfaPasswordInput = z.infer<typeof mfaPasswordInputSchema>;
export type IMfaSetupResponse = z.infer<typeof mfaSetupResponseSchema>;
export type IMfaRecoveryCodesResponse = z.infer<
  typeof mfaRecoveryCodesResponseSchema
>;
export type IMfaStatusResponse = z.infer<typeof mfaStatusResponseSchema>;

/*
 * /api/v1/users/me is the canonical authenticated-session payload. Shape is
 * pulled from the OpenAPI operation rather than restated in Zod because the
 * server owns the contract.
 */
type MeResponse =
  operations["getApiV1UsersMe"]["responses"][200]["content"]["application/json"];

export type IMe = MeResponse;
export type IMembershipRole = MeResponse["role"];
export type IAccountSummary = MeResponse["account"];
export type IMembershipSummary = MeResponse["memberships"][number];
export type IResolvedFeatures = MeResponse["features"];
