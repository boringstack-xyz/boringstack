/**
 * Cap on push subscriptions per user. The browser only holds one
 * subscription per (origin, service-worker), but a user with multiple
 * browsers + devices can legitimately exceed 10. This is a soft anti-abuse
 * limit — clients rotating endpoints maliciously hit it and get a 409.
 */
export const PUSH_SUBSCRIPTIONS_MAX_PER_USER = 25;
