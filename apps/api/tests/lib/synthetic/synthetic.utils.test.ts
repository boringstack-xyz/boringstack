import { describe, expect, test } from "bun:test";

import {
  isSyntheticEmail,
  matchesSyntheticSecret,
  SYNTHETIC_EMAIL_DOMAIN,
} from "../../../src/lib/synthetic";

const SECRET = "a".repeat(64);

describe("isSyntheticEmail", () => {
  test("accepts only the reserved robot domain", () => {
    expect(isSyntheticEmail(`run-1@${SYNTHETIC_EMAIL_DOMAIN}`)).toBe(true);
    expect(
      isSyntheticEmail(`RUN-1@${SYNTHETIC_EMAIL_DOMAIN.toUpperCase()}`)
    ).toBe(true);
    expect(isSyntheticEmail("someone@example.com")).toBe(false);
    expect(isSyntheticEmail(`x@evil.${SYNTHETIC_EMAIL_DOMAIN}`)).toBe(false);
    expect(isSyntheticEmail(`x@${SYNTHETIC_EMAIL_DOMAIN}.example.com`)).toBe(
      false
    );
    expect(isSyntheticEmail(`${SYNTHETIC_EMAIL_DOMAIN}@example.com`)).toBe(
      false
    );
  });
});

describe("matchesSyntheticSecret", () => {
  test("matches only the exact configured secret", () => {
    expect(matchesSyntheticSecret(SECRET, SECRET)).toBe(true);
    expect(matchesSyntheticSecret(`${SECRET}a`, SECRET)).toBe(false);
    expect(matchesSyntheticSecret("b".repeat(64), SECRET)).toBe(false);
  });

  test("an unset or short configured secret matches nothing", () => {
    expect(matchesSyntheticSecret("", "")).toBe(false);
    expect(matchesSyntheticSecret(undefined, "")).toBe(false);
    expect(matchesSyntheticSecret("short", "short")).toBe(false);
  });

  test("a missing header never matches", () => {
    expect(matchesSyntheticSecret(undefined, SECRET)).toBe(false);
    expect(matchesSyntheticSecret("", SECRET)).toBe(false);
  });
});
