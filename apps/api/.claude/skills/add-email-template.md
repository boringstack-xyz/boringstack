---
name: add-email-template
description: Use when adding a new transactional email template to apps/api. There is no `bun run new:email-template` scaffolder; this skill encodes the manual workflow — create the Handlebars files, regenerate the precompiled JSON, call `sendTemplate(...)` at the site that needs it, inspect in Mailpit. Triggers — "add an email template", "new email", "send a [X] email", "wire up the [X] email", "transactional email for [X]", "send mail when [X]".
---

# Add email template (apps/api)

You are adding a new transactional email end-to-end. There is no scaffolder — the moving parts are too varied. Five steps.

## 1 — Pick the slot

Templates live under `src/templates/email/templates/<category>/<name>/`. Existing categories:

- `auth/` — confirm email, password reset, refresh-token replay alert
- `notifications/` — emails sent by the notification dispatcher's email channel

If the new template fits a category, drop it in. Otherwise create a new category folder. The category isn't load-bearing — it's organizational.

The `<name>` is kebab-case. Example: `auth/confirm-your-email/`, `notifications/payment-failed/`.

## 2 — Author the Handlebars files

Inside the new folder, create:

```
<category>/<name>/
├── <name>.hbs        # content body (HTML)
└── <name>.json       # frontmatter: subject template + optional preview text
```

The `.hbs` extends `base.hbs` (shared shell — header, footer, container). Use the registered partials:

- `{{> header}}` — top bar with app name + logo
- `{{> footer}}` — legal / unsub links
- `{{> button label="..." href="..."}}` — primary CTA button

The `.json` shape:

```json
{
  "subject": "Confirm your email, {{firstName}}",
  "preview": "One click to verify and you're in."
}
```

The `subject` is Handlebars-evaluated against the same variables you pass at send time.

## 3 — Regenerate the precompiled JSON

`emailTemplateService` doesn't read `.hbs` at runtime — it reads precompiled JSON from `src/templates/email/dist/`. Run:

```bash
bun run build:templates
```

This compiles every `.hbs` into a JSON spec plus a `partials.json` manifest. The `dist/` files are gitignored in some forks; check `.gitignore` and commit them if not.

## 4 — Call sendTemplate at the right site

The public API is `sendTemplate(input)` from `src/lib/email/`. There is NO per-template wrapper function — callers pass the `templatePath` directly. Example:

```ts
import { sendTemplate } from "../../../lib/email";

await sendTemplate({
  to: user.email,
  subject: "Confirm your email", // also evaluated from the .json frontmatter
  templatePath: "auth/confirm-your-email",
  variables: {
    firstName: user.firstName,
    confirmationUrl: `${env.FRONTEND_URL}/verify-email?token=${token}`,
  },
});
```

`sendTemplate` enqueues a BullMQ job when `QUEUES_ENABLED=true`, or sends inline otherwise. Both paths converge on `sendTemplateNow` for the actual render + send — never call `sendTemplateNow` directly from a request handler.

When the email is fired from a notification event, write the matching `render.email` block in the event definition (the notification dispatcher's email channel calls `sendTemplateNow` for you):

```ts
render: {
  email: {
    subject: ({ payload }) => `New reply on "${payload.postTitle}"`,
    templatePath: "notifications/comment-replied",
    variables: ({ payload }) => ({ /* ... */ }),
  },
}
```

## 5 — Preview in Mailpit + verify

Boot dev compose with the mailpit profile and trigger the send:

```bash
cd ../../infra/compose
WITH_MAILPIT=1 ./scripts/compose-up.sh
```

Trigger the api endpoint that calls `sendTemplate` (or write a one-off Bun script). Open `http://localhost:8025/` (Mailpit web UI). Check: subject substituted, partials resolved, CTA button rendered, mobile width sane.

Sibling test under the template folder (or wherever the calling service's `*.test.ts` lives) asserts the render output:

```ts
import { emailTemplateService } from "../../../../lib/email/template.service";

it("renders auth/confirm-your-email with the firstName substituted", () => {
  const html = emailTemplateService.render("auth/confirm-your-email", {
    subject: "Confirm your email",
    firstName: "Ada",
    confirmationUrl: "https://example.com/verify?token=test",
    appName: "BoringStack",
  });
  expect(html).toContain("Ada");
  expect(html).toContain("https://example.com/verify?token=test");
});
```

Then:

```bash
bun run validate
```

When green and the Mailpit preview looks right, the template is done. Do NOT run `git commit` / `git push`.
