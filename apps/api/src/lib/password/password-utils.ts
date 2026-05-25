import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "./password.constants";

class PasswordService {
  /*
   * Precomputed at module load so the first missing-user login costs the
   * same as the second. Computing this lazily on first call leaks a
   * timing signal: the first 401 takes hashSync + compare; subsequent
   * 401s only do compare. The whole point of the dummy verify is that
   * every "user not found" path costs exactly one bcrypt.compare,
   * indistinguishable from "user exists, wrong password."
   */
  private readonly dummyHash = bcrypt.hashSync(
    "dummy-password-for-timing-invariance",
    BCRYPT_ROUNDS
  );

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Constant-time dummy verify used to flatten the timing signal between
   * "user exists, wrong password" and "user does not exist."
   */
  async performDummyVerify(): Promise<void> {
    await bcrypt.compare("dummy", this.dummyHash);
  }
}

export const passwordService = new PasswordService();
