/*
 * The coverage floor is a ratchet, not a wishlist: it sits a few points
 * below the current measured rate so a small slip triggers the alarm.
 * Raise it as coverage climbs; never lower it to silence a regression.
 * Shared by the single-process gate (check-coverage.ts) and the sharded
 * verification runner, so both enforce the same numbers.
 */
export const MIN_LINE = 0.65;
export const MIN_FUNCTION = 0.7;
