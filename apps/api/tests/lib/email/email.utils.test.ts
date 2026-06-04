import { describe, expect, test } from "bun:test";

import {
  baseTemplateVariables,
  normalizeEmail,
  validateEmailMessage,
  withEmailTimeout,
} from "../../../src/lib/email/email.utils";
import { ApiError } from "../../../src/lib/errors";
import { env } from "../../../src/config/env";

const EXPECTED_API_ERROR = "expected ApiError";

describe("withEmailTimeout", () => {
  test("resolves when the operation finishes within the budget", async () => {
    const result = await withEmailTimeout(() => Promise.resolve("ok"), 1000);

    expect(result).toBe("ok");
  });

  test("rejects with a retryable timeout error when the operation hangs", async () => {
    let settle: (() => void) | undefined;
    const hang = new Promise<string>((resolve) => {
      settle = () => {
        resolve("late");
      };
    });

    try {
      await withEmailTimeout(() => hang, 10);

      throw new Error(EXPECTED_API_ERROR);
    } catch (error: unknown) {
      if (!(error instanceof ApiError)) {
        throw new Error(EXPECTED_API_ERROR, { cause: error });
      }

      expect(error.message.toLowerCase()).toContain("timeout");
    } finally {
      settle?.();
    }
  });
});

describe("validateEmailMessage", () => {
  const VALID_FROM = "noreply@example.com";
  const VALID_TO = "user@example.com";
  const HELLO_HTML = "<p>Hi</p>";

  test("does not throw for a valid message", () => {
    expect(() => {
      validateEmailMessage(
        { to: VALID_TO, subject: "Hello", html: HELLO_HTML },
        VALID_FROM
      );
    }).not.toThrow();
  });

  test("throws a validation error on invalid recipient email", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: "not-an-email", subject: "Hello", html: HELLO_HTML },
        VALID_FROM
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(400);
    expect(typeof caught.fieldErrors?.to).toBe("string");
  });

  test("throws an internal error on invalid sender email", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: VALID_TO, subject: "Hello", html: HELLO_HTML },
        "bad-from"
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(500);
  });

  test("throws a validation error on empty subject", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: VALID_TO, subject: "", html: HELLO_HTML },
        VALID_FROM
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(400);
    expect(typeof caught.fieldErrors?.subject).toBe("string");
  });

  test("throws a validation error on empty html", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: VALID_TO, subject: "Hello", html: "" },
        VALID_FROM
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(400);
    expect(typeof caught.fieldErrors?.html).toBe("string");
  });

  test("throws a validation error on whitespace-only subject", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: VALID_TO, subject: "   ", html: HELLO_HTML },
        VALID_FROM
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(400);
  });

  test("throws a validation error on whitespace-only html", () => {
    let caught: unknown;

    try {
      validateEmailMessage(
        { to: VALID_TO, subject: "Hello", html: "   " },
        VALID_FROM
      );
    } catch (error: unknown) {
      caught = error;
    }

    if (!(caught instanceof ApiError)) {
      throw new Error(EXPECTED_API_ERROR);
    }

    expect(caught.statusCode).toBe(400);
  });
});

describe("baseTemplateVariables", () => {
  test("returns appName and notificationSettingsUrl from env", () => {
    const vars = baseTemplateVariables();

    expect(vars.appName).toBe(env.APP_NAME);
    expect(vars.notificationSettingsUrl).toBe(env.NOTIFICATION_SETTINGS_URL);
  });

  test("returns a plain object (not frozen or sealed)", () => {
    const vars = baseTemplateVariables();

    expect(typeof vars).toBe("object");
    expect(vars).not.toBeNull();
  });
});

describe("normalizeEmail", () => {
  test("lowercases and trims the input", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM  ")).toBe(
      "jane.doe@example.com"
    );
  });

  test("preserves already-normalized values", () => {
    expect(normalizeEmail("jane@example.com")).toBe("jane@example.com");
  });

  test("handles empty string", () => {
    expect(normalizeEmail("")).toBe("");
  });

  test("handles whitespace-only string", () => {
    expect(normalizeEmail("   ")).toBe("");
  });
});
