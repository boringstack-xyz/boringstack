const principles = [
  ["01", "Agent-ready", "One page to get started", "/agents.md"],
  [
    "02",
    "Machine-checked",
    "Architecture enforced by lint + CI",
    "/architecture/lint-as-contract/",
  ],
  [
    "03",
    "Self-hosted",
    "Your infrastructure, your data",
    "/topics/deployment/",
  ],
  [
    "04",
    "Open source",
    "MIT-licensed. Yours to change.",
    "https://github.com/boringstack-xyz/boringstack",
  ],
] as const;

export function StackRibbon() {
  return (
    <nav className="bs-principles" aria-label="BoringStack principles">
      {principles.map(([number, title, detail, href]) => (
        <a key={number} href={href}>
          <span className="bs-index">{number} /</span>
          <div>
            <strong>{title}</strong>
            <span>{detail}</span>
          </div>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </nav>
  );
}
