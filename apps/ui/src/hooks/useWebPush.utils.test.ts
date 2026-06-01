import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "./useWebPush.utils";

describe("urlBase64ToUint8Array", () => {
  it("decodes a standard base64url string", () => {
    const value = "SGVsbG8gV29ybGQ";
    const result = urlBase64ToUint8Array(value);

    expect(Array.from(result)).toEqual([
      72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100
    ]);
  });

  it("replaces url-safe characters (- and _) with standard base64 alphabet", () => {
    const result = urlBase64ToUint8Array("a-_aaaaa");

    expect(result.length).toBe(6);
  });

  it("returns an empty Uint8Array for an empty input", () => {
    const result = urlBase64ToUint8Array("");

    expect(result.length).toBe(0);
  });
});
