/*
 * Argon2id parameters. OWASP 2024 minimum: m=19 MiB, t=2, p=1.
 *
 *   - memoryCost is KiB; 19_456 = 19 MiB
 *   - timeCost is iteration count
 *
 * Tuned for ~80 ms per hash on a modern server core. Raise memoryCost
 * before timeCost if you need more resistance (memory is the expensive
 * resource for GPU attackers).
 */
export const ARGON2ID_MEMORY_COST_KIB = 19_456;
export const ARGON2ID_TIME_COST = 2;

export const ARGON2ID_PREFIX = "$argon2id$";
