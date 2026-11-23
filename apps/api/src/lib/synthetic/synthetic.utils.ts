import { createHash, timingSafeEqual } from "node:crypto";

import { extractDomain } from "../email-domain";
import {
  SYNTHETIC_EMAIL_DOMAIN,
  SYNTHETIC_SECRET_MIN_LENGTH,
} from "./synthetic.constants";

/** True for an address that belongs to the verification robot. */
export const isSyntheticEmail = (email: string): boolean =>
  extractDomain(email) === SYNTHETIC_EMAIL_DOMAIN;

const digest = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

/**
 * Whether a caller presented the robot secret. An unset or short configured
 * secret matches nothing, so the robot routes stay shut until the owner
 * provisions one. Both sides are hashed first: `timingSafeEqual` needs equal
 * lengths, and comparing digests leaks neither the length nor the content.
 */
export const matchesSyntheticSecret = (
  presented: string | undefined,
  configured: string
): boolean => {
  const usable =
    configured.length >= SYNTHETIC_SECRET_MIN_LENGTH &&
    presented !== undefined &&
    presented !== "";

  return usable && timingSafeEqual(digest(presented), digest(configured));
};
