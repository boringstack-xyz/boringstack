import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/ApiError";

import { applyServerErrors } from "./Auth.utils";

interface ILoginForm extends Record<string, unknown> {
  email: string;
  password: string;
}

describe("applyServerErrors", () => {
  it("maps each fieldError into setError with type 'server'", () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: "Validation failed",
      fieldErrors: { email: "Taken", password: "Too weak" }
    });
    const applied = applyServerErrors<ILoginForm>(error, setError);

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

  it("returns false for non-ApiError input", () => {
    const setError = vi.fn();

    expect(applyServerErrors<ILoginForm>(new Error("boom"), setError)).toBe(
      false
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns false when ApiError has no fieldErrors", () => {
    const setError = vi.fn();
    const error = new ApiError(500, { message: "Server error" });

    expect(applyServerErrors<ILoginForm>(error, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns false for null / undefined / string", () => {
    const setError = vi.fn();

    expect(applyServerErrors<ILoginForm>(null, setError)).toBe(false);
    expect(applyServerErrors<ILoginForm>(undefined, setError)).toBe(false);
    expect(applyServerErrors<ILoginForm>("oops", setError)).toBe(false);
  });
});
