import { useState } from "react";

const repo = "https://github.com/boringstack-xyz/boringstack/blob/main/";
const examples = [
  {
    title: "Remove tenant scope",
    file: "account-plans.query.ts",
    kind: "ESLint",
    before:
      "await db.select()\n  .from(accountPlans)\n  .where(eq(accountPlans.accountId, accountId));",
    after:
      "await db.select()\n  .from(accountPlans);\n// accountId filter removed",
    rule: "drizzle-conventions/account-scoped-tables-require-where",
    error: "Query against accountPlans is missing an accountId filter.",
    explanation:
      "Account-scoped queries need a tenant boundary. This rule catches the missing filter before the change ships.",
    source: "apps/api/eslint.config.js#L516",
  },
  {
    title: "Drift the API contract",
    file: "API schema → generated UI client",
    kind: "CI drift check",
    before:
      "API schema      → current\nGenerated client → current\nContract         → in sync",
    after:
      "API schema      → changed\nGenerated client → unchanged\nContract         → drift detected",
    rule: "openapi-drift",
    error: "The committed UI client differs from the regenerated API contract.",
    explanation:
      "CI regenerates the client against the API and checks the diff. An API change must bring its generated client along.",
    source: ".github/workflows/apps-api-openapi-drift.yml",
  },
  {
    title: "Skip webhook verification",
    file: "Stripe webhook · simplified excerpt",
    kind: "ESLint",
    before:
      "const event = await stripe.webhooks\n  .constructEventAsync(rawBody, signature, secret);",
    after:
      "const event = JSON.parse(rawBody);\n// signature verification removed",
    rule: "stripe-webhooks/handler-must-verify-signature",
    error: "The webhook handler must verify the incoming signature.",
    explanation:
      "Parsing a payload does not authenticate its sender. The webhook rules require signature verification.",
    source: "apps/api/eslint.config.js#L556",
  },
];

export function GuardrailDemo() {
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState(false);
  const example = examples[selected];
  return (
    <div className="bs-guardrail-demo">
      <div className="bs-demo-heading">
        <div>
          <span className="bs-demo-eyebrow">INTERACTIVE / 001</span>
          <h3>Go on. Try breaking it.</h3>
        </div>
        <span className="bs-demo-disclaimer">
          Illustrative demo · real repository checks
        </span>
      </div>
      <div className="bs-demo-options" aria-label="Choose a guardrail example">
        {examples.map((item, index) => (
          <button
            type="button"
            key={item.title}
            aria-pressed={selected === index}
            onClick={() => {
              setSelected(index);
              setBroken(false);
            }}
          >
            <span>0{index + 1}</span>
            {item.title}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className="bs-demo-workspace">
        <div className="bs-demo-editor">
          <div className="bs-demo-file">
            <span>{example.file}</span>
            <span>{broken ? "MODIFIED" : "ORIGINAL"}</span>
          </div>
          <pre tabIndex={0} aria-label="Illustrative code excerpt">
            <code>{broken ? example.after : example.before}</code>
          </pre>
          <button
            className="bs-demo-run"
            type="button"
            onClick={() => setBroken(!broken)}
          >
            {broken ? "↻ Restore the example" : "Break it →"}
          </button>
        </div>
        <div
          className="bs-demo-result"
          data-broken={broken}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="bs-demo-eyebrow">
            {example.kind} / EXAMPLE RESULT
          </span>
          <h4>{broken ? "× Change blocked." : "✓ Boundary intact."}</h4>
          <div className="bs-demo-rule">
            <code>{example.rule}</code>
          </div>
          <p>
            {broken
              ? example.error
              : "The example preserves the contract. Remove it and see what catches the change."}
          </p>
        </div>
      </div>
      <div className="bs-demo-footnote">
        <p>{example.explanation}</p>
        <a
          href={`${repo}${example.source}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Inspect the check ↗
        </a>
      </div>
    </div>
  );
}
