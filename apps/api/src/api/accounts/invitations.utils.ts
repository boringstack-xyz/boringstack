const DEFAULT_TTL_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/**
 * The invitation TTL ceiling. Default is 14 days; per-deployment
 * override should land via env var when the `INVITATION_TTL_DAYS`
 * setting is wired.
 */
export const computeInvitationExpiresAt = (): string =>
  new Date(Date.now() + DEFAULT_TTL_DAYS * MS_PER_DAY).toISOString();

export const normalizeInvitationEmail = (email: string): string =>
  email.toLowerCase().trim();
