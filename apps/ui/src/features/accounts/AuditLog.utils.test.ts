import { describe, expect, it } from "vitest";

import type { IAuditLogEntry } from "./AuditLog.types";
import { formatAction, formatActor } from "./AuditLog.utils";

function entry(overrides: Partial<IAuditLogEntry>): IAuditLogEntry {
  return {
    id: "e1",
    action: "auth.login_success",
    resource: null,
    metadata: {},
    createdAt: "2026-05-27T12:00:00.000Z",
    actorUserId: "u1",
    actorEmail: null,
    actorFirstName: null,
    actorLastName: null,
    ...overrides
  };
}

describe("formatActor", () => {
  it("prefers real first + last name when present", () => {
    expect(
      formatActor(
        entry({ actorFirstName: "Alex", actorLastName: "Owner" }),
        "System"
      )
    ).toBe("Alex Owner");
  });

  it("falls back to email when names are missing", () => {
    expect(
      formatActor(entry({ actorEmail: "alex@example.com" }), "System")
    ).toBe("alex@example.com");
  });

  it("returns the fallback for system-initiated rows", () => {
    expect(formatActor(entry({ actorUserId: null }), "System")).toBe("System");
  });

  it("trims to the non-empty name when only one of first/last is set", () => {
    expect(
      formatActor(
        entry({ actorFirstName: "Solo", actorLastName: null }),
        "System"
      )
    ).toBe("Solo");
  });
});

describe("formatAction", () => {
  it("converts dotted snake-case to spaced sentence", () => {
    expect(formatAction("auth.login_success")).toBe("Auth login success");
  });

  it("uppercases only the first letter", () => {
    expect(formatAction("membership.role_changed")).toBe(
      "Membership role changed"
    );
  });
});
