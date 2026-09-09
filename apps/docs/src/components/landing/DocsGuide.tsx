import { installCommand, setupNote } from "./landingContent";
import { SectionHeading } from "./LandingPrimitives";

const steps = [
  {
    number: "01",
    file: "/agents.md",
    title: "Give your agent the map.",
    detail:
      "Setup instructions, health checks, and the rules it must preserve. One fetch to get its bearings.",
    href: "/agents.md",
    link: "Read the agent contract",
  },
  {
    number: "02",
    file: "/install.sh",
    title: "Let the stack assemble.",
    detail:
      "Preflight, scaffold, rename, boot, and health check. Five phases from a fresh project to a running stack.",
    href: "/quickstart/",
    link: "Follow the quickstart",
  },
  {
    number: "03",
    file: "your first feature",
    title: "Build something that matters.",
    detail:
      "Add a feature with the contracts in place. Open the relevant recipe or runbook when you need it.",
    href: "/skills/first-feature-tutorial/",
    link: "Build your first feature",
  },
];

export function DocsGuide() {
  return (
    <section className="bs-section" aria-labelledby="bs-docs-title">
      <SectionHeading
        id="bs-docs-title"
        eyebrow="03 / FIRST CONTACT"
        title="One instruction. Then your first feature."
        body="The setup is documented for your agent and readable by you. Start with the map; pull in the details as you build."
      />
      <div className="bs-setup-steps">
        {steps.map((step) => (
          <a key={step.number} href={step.href}>
            <div className="bs-step-top">
              <span>{step.number}</span>
              <span>{step.file}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <span className="bs-text-link">
              {step.link} <span aria-hidden="true">↗</span>
            </span>
          </a>
        ))}
      </div>
      <details className="bs-install-details">
        <summary>
          Prefer to run the installer yourself?{" "}
          <span aria-hidden="true">+</span>
        </summary>
        <div>
          <pre tabIndex={0} aria-label="Install command">
            <code>{installCommand}</code>
          </pre>
          <p>{setupNote}</p>
        </div>
      </details>
    </section>
  );
}
