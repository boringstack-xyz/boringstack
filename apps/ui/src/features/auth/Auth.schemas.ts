import { z } from "zod";

export const loginInputSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export const registerInputSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/u, "Use upper, lower, and a digit."),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional()
});

export const verifyEmailInputSchema = z.object({
  token: z.string().min(16).max(255)
});

export const resendVerificationInputSchema = z.object({
  email: z.email("Please enter a valid email.")
});

export const updateProfileInputSchema = z.object({
  firstName: z.string().max(100),
  lastName: z.string().max(100)
});

export const forgotPasswordInputSchema = z.object({
  email: z.email("Please enter a valid email.")
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(16).max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/u, "Use upper, lower, and a digit.")
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(8, "Password must be at least 8 characters."),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/u, "Use upper, lower, and a digit.")
});

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const loginResponseSchema = z.object({
  user: userSchema
});
