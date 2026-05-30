---
name: add-audit-event
description: Use when adding a single audit-log entry to an existing service in apps/api. Drives the minimal change — pick an action name, decide what metadata is safe (no PII), wire `auditLogService.record(...)` into the right place, add a sibling test. Triggers — "add an audit event", "wire audit log into [X]", "log this for audit", "make sure we audit [X]", "add tracking for [X]", "record [X] in audit".
---

# Add audit event (apps/api)

You are adding ONE call to `auditLogService.record(...)` into an existing service. This is a narrow scaffold — no spec/plan checkpoints. Just the four actions below.

## 1 — Pick the action name

Format: `<resource>.<verb_past>` in snake_case. The action ends with a state-change verb in past tense.

Examples already in use:

- `auth.user_registered`
- `auth.password_reset`
- `auth.refresh_replay` (security-critical, fires when a leaked refresh token is presented)
- `billing.subscription_updated`
- `notifications.preferences_changed`

Bad: `user_action`, `clicked_button`, `ticket_thing`. The action name is queryable; vague names poison the audit log.

## 2 — Decide metadata

`metadata` is a JSONB column. The hard rule from AGENT_CONTRACT.md: **no PII**. That means no email, no name, no raw IP, no full user agent, no plain-text token, no Stripe customer email. The `audit-log/audit-metadata-no-pii` ESLint rule enforces it — write the metadata such that the rule passes without an exception.

What's safe:

- Resource IDs (`{ subscriptionId: "sub_..." }`)
- Enum values (`{ from: "pending", to: "active" }`)
- Booleans (`{ wasOwner: true }`)
- Counts (`{ deletedRowCount: 3 }`)

What's NOT safe:

- `{ email: "..." }` → use `userId` instead, look up the email separately if needed
- `{ ip: "1.2.3.4" }` → already captured in the top-level `ip` field; don't duplicate into metadata
- `{ token: "..." }` → never log tokens, even hashed

## 3 — Wire the call

Inside the service method, immediately after the DB write (or whichever boundary marks "the thing happened"):

```ts
await auditLogService.record({
  userId: ctx.userId,
  action: "billing.subscription_updated",
  resource: subscriptionId,
  metadata: {
    from: previousStatus,
    to: nextStatus,
    planKey: nextPlan,
  },
  ip: ctx.ip,
  userAgent: ctx.userAgent,
});
```

Notes:

- `auditLogService` is in `src/lib/audit-log/audit-log.service.ts` — import the singleton, not the class.
- The method is `record`, not `write`. The name is part of the public API.
- The call is fire-and-forget by design. A failed audit insert is logged and swallowed; it never fails the user-facing request.
- For sensitive flows where you MUST observe the write succeeded, `await` the result and check `success`.

## 4 — Sibling test

The service file already has a `*.test.ts` sibling (lint:meta enforces this). Add a single test case that asserts the audit was recorded with the right shape:

```ts
it("records audit event when subscription is updated", async () => {
  const spy = vi.spyOn(auditLogService, "record");

  await billingService.updateSubscription({ ... });

  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "billing.subscription_updated",
      resource: expect.any(String),
      metadata: expect.objectContaining({ to: "active" }),
    })
  );
  // Crucially: assert NO PII fields.
  const call = spy.mock.calls[0][0];
  expect(call.metadata).not.toHaveProperty("email");
});
```

The "no PII" assertion is the part that's easy to forget. Include it on every audit-event test.

## 5 — Verify

```bash
bun run lint        # catches PII-shaped keys in metadata via audit-metadata-no-pii
bun test src/<service-path>
```

When both are green, the change is done. Do NOT run `git commit` / `git push`.
