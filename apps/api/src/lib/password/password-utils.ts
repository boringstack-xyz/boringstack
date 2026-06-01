import {
  ARGON2ID_MEMORY_COST_KIB,
  ARGON2ID_PREFIX,
  ARGON2ID_TIME_COST,
} from "./password.constants";

const ARGON2ID_OPTIONS = {
  algorithm: "argon2id",
  memoryCost: ARGON2ID_MEMORY_COST_KIB,
  timeCost: ARGON2ID_TIME_COST,
} as const;

class PasswordService {
  /*
   * Precomputed at module load so the first missing-user login costs the
   * same as the second. Computing this lazily on first call leaks a
   * timing signal: the first 401 takes hashSync + compare; subsequent
   * 401s only do compare. The whole point of the dummy verify is that
   * every "user not found" path costs exactly one password verify,
   * indistinguishable from "user exists, wrong password."
   *
   * argon2id-shaped because all new hashes use argon2id; bcrypt hashes
   * (carried over from earlier installs) still verify transparently via
   * Bun.password.verify autodetecting the prefix.
   */
  private readonly dummyHash = Bun.password.hashSync(
    "dummy-password-for-timing-invariance",
    ARGON2ID_OPTIONS
  );

  async hash(plain: string): Promise<string> {
    return Bun.password.hash(plain, ARGON2ID_OPTIONS);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    /*
     * Bun.password.verify throws on unrecognised algorithms (e.g. empty
     * string or garbage from a corrupted row). Treat that as a verify
     * failure so attackers probing with bogus hashes get a generic 401
     * instead of a 500 they can use to fingerprint the algorithm set.
     */
    try {
      return await Bun.password.verify(plain, hash);
    } catch {
      return false;
    }
  }

  /**
   * Returns true when `hash` is not the current canonical algorithm —
   * callers should re-hash with `hash()` after a successful verify and
   * persist the new value. Lazy migration with zero forced resets.
   */
  needsRehash(hash: string): boolean {
    return !hash.startsWith(ARGON2ID_PREFIX);
  }

  /**
   * Constant-time dummy verify used to flatten the timing signal between
   * "user exists, wrong password" and "user does not exist."
   */
  async performDummyVerify(): Promise<void> {
    await Bun.password.verify("dummy", this.dummyHash);
  }
}

export const passwordService = new PasswordService();
