import { stackLinks } from "./landingContent";

export function StackRibbon() {
  return (
    <section
      aria-label="Composed templates"
      className="grid grid-cols-1 border-y border-[var(--bs-line)] min-[641px]:grid-cols-2 lg:grid-cols-4"
    >
      {stackLinks.map((link) => (
        <a
          className="grid min-w-0 gap-1 border-t border-[var(--bs-line)] px-5 py-4 text-inherit no-underline transition-colors first:border-t-0 hover:bg-[var(--bs-accent-low)] min-[641px]:border-l min-[641px]:first:border-l-0 min-[641px]:[&:nth-child(2)]:border-t-0 lg:border-t-0"
          href={link.href}
          key={link.href}
        >
          <span className="font-extrabold leading-tight text-[var(--bs-text)]">{link.label}</span>
          <small className="leading-snug text-[var(--bs-muted)]">{link.detail}</small>
        </a>
      ))}
    </section>
  );
}
