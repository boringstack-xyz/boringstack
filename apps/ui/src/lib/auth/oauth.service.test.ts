import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerInfoSpy = vi.fn();

vi.mock("@/lib/logger/logger", () => ({
  logger: {
    info: (...args: unknown[]): void => {
      loggerInfoSpy(...args);
    },
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

const envState = {
  VITE_API_URL: ""
};

vi.mock("@/lib/env", () => ({
  env: envState
}));

beforeEach(() => {
  loggerInfoSpy.mockClear();
  envState.VITE_API_URL = "";
  vi.resetModules();
});

async function importService() {
  return import("./oauth.service");
}

describe("startOAuth", () => {
  it("logs the event and navigates the browser to the API's start endpoint", async () => {
    const assignSpy = vi.fn();

    vi.stubGlobal("window", {
      location: { assign: assignSpy }
    });

    const mod = await importService();

    mod.startOAuth("google");

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "oauth.start", provider: "google" })
    );
    expect(assignSpy).toHaveBeenCalledWith("/api/v1/auth/oauth/google");
  });

  it("constructs the right path per provider", async () => {
    const assignSpy = vi.fn();

    vi.stubGlobal("window", {
      location: { assign: assignSpy }
    });

    const mod = await importService();

    mod.startOAuth("github");

    expect(assignSpy).toHaveBeenCalledWith("/api/v1/auth/oauth/github");
  });

  it("uses VITE_API_URL when OAuth lives on a separate API origin", async () => {
    envState.VITE_API_URL = "https://api.example.com/";
    const assignSpy = vi.fn();

    vi.stubGlobal("window", {
      location: { assign: assignSpy }
    });

    const mod = await importService();

    mod.startOAuth("linkedin");

    expect(assignSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/auth/oauth/linkedin"
    );
  });
});
