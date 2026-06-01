import { describe, expect, it } from "bun:test";

import {
  BootInvariantError,
  assertBootInvariants,
  collectBootInvariantViolations,
} from "../../src/boot/invariants";
import { validateEnv } from "../../src/config/env/validate";

const VALID_MFA_KEY = "RGdmRXJVbmlrV3VqWUFwR2VVZkdLUlBmYWxsa2VBQ08=";

/*
 * Produce a real validated env so the boot-invariant tests work
 * against the same shape the boot path sees. The validator runs in
 * NODE_ENV=test mode (uses the deterministic test MFA key), then we
 * mutate MFA_ENCRYPTION_KEY for the specific failure-mode under
 * test.
 */
function baseEnv(overrides: { MFA_ENCRYPTION_KEY?: string } = {}) {
  const env = validateEnv({ NODE_ENV: "test" });

  env.MFA_ENCRYPTION_KEY = overrides.MFA_ENCRYPTION_KEY ?? VALID_MFA_KEY;

  return env;
}

describe("collectBootInvariantViolations", () => {
  it("returns no violations on a valid config", () => {
    expect(collectBootInvariantViolations(baseEnv())).toEqual([]);
  });

  it("blocks E2E_TEST_ENDPOINTS_ENABLED=true in production", () => {
    const env = baseEnv();

    env.NODE_ENV = "production";
    env.E2E_TEST_ENDPOINTS_ENABLED = true;

    const violations = collectBootInvariantViolations(env);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/E2E_TEST_ENDPOINTS_ENABLED is true/);
    expect(violations[0]).toMatch(/__test/);
  });

  it("allows E2E_TEST_ENDPOINTS_ENABLED=true outside production", () => {
    const env = baseEnv();

    env.NODE_ENV = "development";
    env.E2E_TEST_ENDPOINTS_ENABLED = true;

    expect(collectBootInvariantViolations(env)).toEqual([]);
  });

  it("treats an empty MFA_ENCRYPTION_KEY as allowed (env validator already gates prod)", () => {
    expect(
      collectBootInvariantViolations(baseEnv({ MFA_ENCRYPTION_KEY: "" }))
    ).toEqual([]);
  });

  it("flags an MFA_ENCRYPTION_KEY that doesn't decode to 32 bytes", () => {
    const short = Buffer.from("too-short").toString("base64");
    const violations = collectBootInvariantViolations(
      baseEnv({ MFA_ENCRYPTION_KEY: short })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/MFA_ENCRYPTION_KEY decoded to/);
    expect(violations[0]).toMatch(/openssl rand -base64 32/);
  });

  it("flags an MFA_ENCRYPTION_KEY that's too long", () => {
    const long = Buffer.from(new Uint8Array(64)).toString("base64");
    const violations = collectBootInvariantViolations(
      baseEnv({ MFA_ENCRYPTION_KEY: long })
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/expected 32/);
  });
});

describe("assertBootInvariants", () => {
  it("does not throw on a valid config", () => {
    expect(() => {
      assertBootInvariants(baseEnv());
    }).not.toThrow();
  });

  it("throws BootInvariantError with the full violation list when invariants fail", () => {
    const short = Buffer.from("nope").toString("base64");
    let thrown: unknown;

    try {
      assertBootInvariants(baseEnv({ MFA_ENCRYPTION_KEY: short }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BootInvariantError);

    if (!(thrown instanceof BootInvariantError)) {
      throw new Error("expected a BootInvariantError");
    }

    expect(thrown.violations).toHaveLength(1);
    expect(thrown.message).toMatch(/Boot invariants failed/);
  });
});
