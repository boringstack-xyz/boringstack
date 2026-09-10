import { GuardrailDemo } from "./GuardrailDemo";
import { SectionHeading } from "./LandingPrimitives";

export function GuardrailsSection() {
  return (
    <section className="bs-section" aria-labelledby="bs-guardrails-title">
      <SectionHeading
        id="bs-guardrails-title"
        eyebrow="01 / THE GUARDRAILS"
        title="Move fast. Keep the boundaries."
        body="Your agent writes the code. Lint and CI check the contracts it has to preserve. Remove a boundary below and see what catches the change."
      />
      <GuardrailDemo />
      <div className="bs-check-links" aria-label="More architectural checks">
        <span>ALSO UNDER WATCH</span>
        <a href="/architecture/lint-as-contract/">
          Module boundaries <span aria-hidden="true">↗</span>
        </a>
        <a href="/api/auth/">
          Permissions & ACL drift <span aria-hidden="true">↗</span>
        </a>
        <a href="/architecture/background-work/">
          Jobs & retries <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
