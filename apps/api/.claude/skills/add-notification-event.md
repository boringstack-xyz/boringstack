---
name: add-notification-event
description: Use when adding a new in-app notification event type to api-template. Wraps `bun run new:notification-event` with the dedup-strategy decision, the render functions, and the dispatcher call. Triggers — "add a notification event", "new notification type", "notify user when [X]", "wire up notification for [X]", "add in-app alert for [X]".
---

# Add notification event (api-template)

You are adding a new notification event type. Notifications are typed events defined with `defineNotificationEvent`, registered in the events barrel, and dispatched through the `notifications` singleton. Five steps.

## 1 — Pick the event name

Format: `<feature>.<verb_past>` in dot notation. Examples:

- `comment.replied`
- `billing.invoice_paid`
- `auth.unusual_login`

The scaffolder accepts the dotted form; the filename is the same with dots replaced by hyphens (`comment.replied` → `comment-replied.event.ts`).

## 2 — Run the scaffolder

```bash
bun run new:notification-event -- <feature>.<verb_past>
```

Generated:

- `src/api/notifications/events/<filename>.event.ts` — a `defineNotificationEvent({...})` call with a starter TypeBox schema, default channels, and a stub `render.inApp`
- Appended import + array entry in `src/api/notifications/events/index.ts` (the barrel)
- Sibling `<filename>.event.test.ts` — empty by default; `lint:meta` requires it to have at least one real assertion

`git status -s` after running. Confirm both files appeared.

## 3 — Tailor the schema, channels, and dedup

Open the new event file. Edit these in order:

**`schema`** — the payload contract. TypeBox; example for a comment reply:

```ts
schema: t.Object({
  actorId: t.String({ format: "uuid" }),
  actorName: t.String(),
  commentId: t.String({ format: "uuid" }),
  postTitle: t.String(),
  snippet: t.String({ maxLength: 200 }),
}),
```

The schema validates every payload synchronously at dispatch time. Malformed call sites fail fast in tests.

**`defaultChannels`** — what fires when no user preference is set. Most events stay `["in-app"]`. Add `"email"` for things the user must see even if logged out.

**`dedup`** (optional) — three patterns:

| Strategy                       | When                                    | `key` returns                                              |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------- |
| **Per-resource** (most common) | Don't notify twice about the same thing | `` `${event.type}:${payload.commentId}` ``                 |
| **Per-user-day**               | Daily digest — one per user per UTC day | `` `${event.type}:${recipientUserId}:${todayUtcDate()}` `` |
| **No dedup**                   | Every fire is its own notification      | Omit the `dedup` block entirely                            |

The `windowSeconds` controls the dedup table TTL. Match it to the strategy: per-resource → hours/days; per-user-day → 24h.

**`selfActionGuard`** (optional) — return `true` to suppress dispatch when the recipient was the actor. Use for `comment.replied`, `mention.created`, etc.

## 4 — Write the render functions

`render.inApp` receives `{ recipientUserId, payload }` and returns `{ title, body, ctaUrl?, ctaLabel? }`. The framework's contract is **the backend owns the final strings** — the UI consumes `title` and `body` verbatim without interpreting the event type. So write the strings here, in their final form. (Today's framework is English-only at this layer; per-user-locale rendering is a separate workstream when it lands.)

```ts
render: {
  inApp: ({ payload }) => ({
    title: `${payload.actorName} replied to your comment`,
    body: `On "${payload.postTitle}": ${payload.snippet}`,
    ctaUrl: `${env.FRONTEND_URL}/posts/${payload.postId}#comment-${payload.commentId}`,
    ctaLabel: "View reply",
  }),
}
```

For email, add the optional `render.email` block:

```ts
render: {
  inApp: /* as above */,
  email: {
    subject: ({ payload }) => `New reply on "${payload.postTitle}"`,
    templatePath: "notifications/comment-replied",
    variables: ({ payload }) => ({
      actorName: payload.actorName,
      postTitle: payload.postTitle,
      snippet: payload.snippet,
    }),
  },
}
```

The `templatePath` must exist under `src/templates/email/templates/`. If it doesn't, also run `/add-email-template` for the matching slot before merging.

## 5 — Dispatch + test + verify

In the service that triggers the event (e.g. `comments.service.ts` after a reply lands), import the event + the dispatcher:

```ts
import { notifications } from "../../lib/notifications";
import { commentRepliedEvent } from "../notifications/events/comment-replied.event";

// inside the service method, after the DB write:
void notifications.send(commentRepliedEvent, {
  recipientUserId: parentComment.authorId,
  payload: {
    actorId: replier.id,
    actorName: replier.displayName,
    commentId: reply.id,
    postTitle: post.title,
    snippet: truncate(reply.body, 80),
  },
});
```

`void`-prefix the call site in production paths (delivery never blocks the request). `await` it in tests where you need to assert dispatch happened.

The sibling `<filename>.event.test.ts` asserts:

- `render.inApp(...)` returns non-empty `title` + `body` for a representative payload
- `dedup.key(...)` (if present) returns the expected shape for two payloads that should dedupe and two that should not
- `selfActionGuard(...)` (if present) returns `true` only when recipient === actor

Then:

```bash
bun run validate
```

When green, the event is live. Do NOT run `git commit` / `git push`.
