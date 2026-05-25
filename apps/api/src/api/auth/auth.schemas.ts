import { t } from "elysia";

const PasswordSchema = t.String({
  minLength: 8,
  pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
  error:
    "Password must be at least 8 chars and contain a lowercase letter, uppercase letter, and digit",
});

export const PublicUserSchema = t.Object({
  id: t.String(),
  email: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  emailVerified: t.Boolean(),
});

export const AuthSuccessData = t.Object({
  user: PublicUserSchema,
});

export const AuthResponse = t.Object({
  success: t.Boolean(),
  data: AuthSuccessData,
  timestamp: t.String(),
});

export const MessageResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({ message: t.String() }),
  timestamp: t.String(),
});

export const RegisterSchema = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
  password: PasswordSchema,
  firstName: t.Optional(t.String({ maxLength: 100 })),
  lastName: t.Optional(t.String({ maxLength: 100 })),
});

export const LoginSchema = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
  password: t.String(),
});

export const VerifyEmailSchema = t.Object({
  token: t.String({ minLength: 16, maxLength: 255 }),
});

export const ResendVerificationSchema = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
});

export const ForgotPasswordSchema = t.Object({
  email: t.String({ format: "email", maxLength: 255 }),
});

export const ResetPasswordSchema = t.Object({
  token: t.String({ minLength: 16, maxLength: 255 }),
  password: PasswordSchema,
});

export const ChangePasswordSchema = t.Object({
  currentPassword: t.String({ minLength: 1 }),
  newPassword: PasswordSchema,
});
