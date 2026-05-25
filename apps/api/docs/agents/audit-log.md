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
  action: AUDIT_ACTIONS.WIDGET_CREATED,
  metadata: { widgetId: created.id }, // no PII
});
```

Always `void`-prefixed. Awaiting an audit write means a flaky audit
table can break a real request.

## Skill

`/add-audit-event` walks the narrow workflow: pick an action name,
decide no-PII metadata, wire the call, add the assertion.
