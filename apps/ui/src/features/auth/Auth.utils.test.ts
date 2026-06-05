import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { applyServerErrors } from "./Auth.utils";

interface ILoginForm extends Record<string, unknown> {
  email: string;
  password: string;
}

const FIELDS = ["email", "password"] as const;

describe("applyServerErrors", () => {
  it("maps each fieldError into setError with type 'server'", () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: "Validation failed",
      fieldErrors: { email: "Taken", password: "Too weak" }
    });
    const applied = applyServerErrors<ILoginForm>(error, setError, FIELDS);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Taken"
    });
    expect(setError).toHaveBeenCalledWith("password", {
      type: "server",
      message: "Too weak"
    });
  });

  it("ignores server keys that are not declared form fields", () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: "Validation failed",
      fieldErrors: { email: "Taken", captcha: "spurious" }
    });
    const applied = applyServerErrors<ILoginForm>(error, setError, FIELDS);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Taken"
    });
  });

  it("returns false for non-ApiError input", () => {
    const setError = vi.fn();

    expect(
      applyServerErrors<ILoginForm>(new Error("boom"), setError, FIELDS)
    ).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns false when ApiError has no fieldErrors", () => {
    const setError = vi.fn();
    const error = new ApiError(500, { message: "Server error" });

    expect(applyServerErrors<ILoginForm>(error, setError, FIELDS)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns false for null / undefined / string", () => {
    const setError = vi.fn();

    expect(applyServerErrors<ILoginForm>(null, setError, FIELDS)).toBe(false);
    expect(applyServerErrors<ILoginForm>(undefined, setError, FIELDS)).toBe(
      false
    );
    expect(applyServerErrors<ILoginForm>("oops", setError, FIELDS)).toBe(false);
  });
});
