import { stackFlow } from "./landingContent";
import { SectionHeading } from "./LandingPrimitives";

export function StackFlowSection() {
  return (
    <section aria-labelledby="bs-compose-title" className="mt-14 min-[641px]:mt-[clamp(4.8rem,6.5vw,6rem)]">
      <SectionHeading
        body="Separate GitHub repos per concern, wired through OpenAPI and Compose. Auth, billing, queues, Traefik TLS, and deploy scripts cross layer boundaries."
        eyebrow="Templates"
        id="bs-compose-title"
        title="What each layer ships."
      />

      <div
        aria-label="BoringStack repository map"
        className="mt-8 grid grid-cols-1 border-y border-[var(--bs-line)] min-[641px]:grid-cols-2 lg:grid-cols-4"
      >
        {stackFlow.map((item, index) => (
          <a
            className="group relative grid min-h-0 grid-rows-[auto_auto_1fr] gap-2 border-t border-[var(--bs-line)] p-4 text-inherit no-underline transition-colors first:border-t-0 hover:bg-[rgba(255,255,255,0.018)] min-[641px]:min-h-48 min-[641px]:p-[1.2rem_1.15rem_1.25rem] min-[641px]:[&:nth-child(2)]:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0"
            href={item.href}
            key={item.href}
          >
            <span className="font-mono text-[0.84rem] font-extrabold leading-snug text-[var(--bs-accent-strong)]">
              {item.label}
            </span>
            <strong className="text-[1.08rem] leading-tight text-[var(--bs-text)] group-hover:text-[var(--bs-accent-strong)] min-[641px]:text-[1.22rem]">
              {item.title}
            </strong>
            <small className="self-start leading-[1.58] text-[var(--bs-muted)] min-[641px]:self-end">
              {item.detail}
            </small>
            <span className="pointer-events-none absolute left-4 right-4 top-[-1px] hidden h-0.5 bg-transparent group-hover:bg-[linear-gradient(90deg,var(--bs-accent),transparent)] min-[641px]:block" />
            {index < stackFlow.length - 1 ? (
              <span className="pointer-events-none absolute right-[-0.6rem] top-[1.12rem] z-[1] hidden font-mono text-[0.85rem] text-[var(--bs-accent-strong)] opacity-70 lg:block">
                -&gt;
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}
