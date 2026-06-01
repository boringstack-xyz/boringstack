/**
 * Returns the channel name the SSE endpoint subscribes to for a given user.
 * Centralised so the publisher (SSE channel implementation) and the
 * subscriber (SSE route handler) agree on the convention.
 */
export const userNotificationChannel = (userId: string): string =>
  `notifications:user:${userId}`;
