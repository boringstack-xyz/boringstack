import type { IUser } from "@/features/auth/Auth.types";

/**
 * Render-safe name string for a user. Falls back to email when the user has
 * no first/last name set (e.g. fresh OAuth registration, or skipped profile).
 */
export function displayName(user: IUser): string {
  const full = `${user.firstName} ${user.lastName}`.trim();

  return full !== "" ? full : user.email;
}
