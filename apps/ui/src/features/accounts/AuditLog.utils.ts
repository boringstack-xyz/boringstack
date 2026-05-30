import type { IAuditLogEntry } from "./AuditLog.types";

/**
 * Pick a human-readable label for the actor. Order: real name →
 * email → fallback "System" for unattributed (system-initiated)
 * actions where the audit row has no user.
 */
export function formatActor(entry: IAuditLogEntry, fallback: string): string {
  const first = entry.actorFirstName ?? "";
  const last = entry.actorLastName ?? "";
  const fullName = `${first} ${last}`.trim();

  if (fullName !== "") {
    return fullName;
  }

  const email = entry.actorEmail ?? "";

  if (email !== "") {
    return email;
  }

  return fallback;
}

/**
 * Audit action names are dotted snake-case (`auth.login_success`).
 * Render them as readable text by replacing separators with spaces
 * and capitalising the first letter.
 */
export function formatAction(action: string): string {
  const spaced = action.replace(/[._]/gu, " ");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
