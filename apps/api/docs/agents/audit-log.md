# Audit log

Read this when adding or modifying a mutating service method, OR adding
an `AUDIT_ACTIONS.*` constant.

## The rule

The `audit-log/mutating-service-must-audit` plugin requires every
mutating service method to record an event. Action names live in
`src/lib/audit-log/audit-log.constants.ts` (`AUDIT_ACTIONS.*`).

```ts
void auditLogService.record({
  userId: created.id, // null for system actions
  action: AUDIT_ACTIONS.NOTIFICATION_STATUS_UPDATED,
  metadata: { notificationId: created.id }, // no PII
});
```

Always `void`-prefixed. Awaiting an audit write means a flaky audit
table can break a real request.

The rule checks the service's public surface: exported functions, public
methods and properties of exported service objects whose names start with
a mutating verb. A module-private helper or a `private` method called from
inside an audited method (an `insertDetail` step of an audited
`createComponent` transaction) is part of that method's body and records
nothing of its own.

## Skill

`/add-audit-event` walks the narrow workflow: pick an action name,
decide no-PII metadata, wire the call, add the assertion.
