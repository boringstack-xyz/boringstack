import { describe, expect, it } from "bun:test";
import { parseDefaultHeaders } from "../../../src/lib/ai/ai.utils";

describe("parseDefaultHeaders", () => {
  it("returns undefined for an empty string", () => {
    expect(parseDefaultHeaders("")).toBeUndefined();
  });

  it("parses a JSON object of string-valued headers", () => {
    const out = parseDefaultHeaders(
      '{"HTTP-Referer":"https://example.com","X-Title":"Acme"}'
    );

    expect(out).toEqual({
      "HTTP-Referer": "https://example.com",
      "X-Title": "Acme",
    });
  });

  it("drops non-string values silently", () => {
    expect(parseDefaultHeaders('{"a":"x","b":42,"c":null}')).toEqual({
      a: "x",
    });
  });

  it("returns undefined for invalid JSON", () => {
    expect(parseDefaultHeaders("not json")).toBeUndefined();
  });

  it("returns undefined for a JSON array", () => {
    expect(parseDefaultHeaders('["nope"]')).toBeUndefined();
  });

  it("returns undefined when the parsed object has no string values", () => {
    expect(parseDefaultHeaders('{"a":42}')).toBeUndefined();
  });
});
