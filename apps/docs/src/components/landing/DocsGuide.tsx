import { docsCoverage, docsSteps } from "./landingContent";
import { Eyebrow } from "./LandingPrimitives";

export function DocsGuide() {
  return (
    <section
      aria-labelledby="bs-docs-title"
      className="relative mt-14 grid grid-cols-1 gap-x-[clamp(2rem,6vw,5rem)] gap-y-7 overflow-hidden border-y border-[var(--bs-line)] px-4 py-8 min-[641px]:mt-[clamp(4.2rem,7vw,6rem)] min-[641px]:px-0 min-[641px]:py-[clamp(2rem,4vw,3rem)] lg:grid-cols-[minmax(0,0.78fr)_minmax(24rem,1fr)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_5rem,rgba(255,255,255,0.025)_5rem_calc(5rem+1px))] opacity-50 min-[641px]:bg-[repeating-linear-gradient(90deg,transparent_0_5.8rem,rgba(255,255,255,0.025)_5.8rem_calc(5.8rem+1px))]" />

      <div className="relative z-[1] self-start">
        <Eyebrow>How to use this documentation</Eyebrow>
        <h2
          className="mt-[0.45rem] max-w-full text-[2.35rem] leading-[1.02] text-[var(--bs-text)] min-[641px]:max-w-[16ch] min-[641px]:text-[3.1rem] lg:max-w-[14ch] lg:text-[clamp(3.2rem,5.5vw,4.8rem)]"
          id="bs-docs-title"
        >
          Architecture first, reference on demand.
        </h2>
        <p className="mt-5 max-w-[38rem] text-[1.04rem] leading-[1.72] text-[var(--bs-muted)]">
          Run the quickstart, then open the page for the subsystem you are editing: auth routes while
          changing auth, queue docs while adding a worker, deploy runbooks when you touch Traefik or
          TLS. The architecture pages explain repo boundaries and lint rules; the rest is reference.
        </p>
      </div>

      <div
        aria-label="Suggested documentation path"
        className="relative z-[1] grid self-center"
      >
        {docsSteps.map((step) => (
          <a
            className="group grid grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-3 border-t border-[var(--bs-line)] py-4 text-inherit no-underline first:border-t-0 min-[641px]:grid-cols-[3.25rem_minmax(0,1fr)] min-[641px]:gap-4"
            href={step.href}
            key={step.number}
          >
            <span className="mt-0.5 font-mono text-[0.92rem] font-extrabold leading-snug text-[var(--bs-accent-strong)]">
              {step.number}
            </span>
            <span className="grid min-w-0 gap-1">
              <strong className="text-[1.08rem] leading-tight text-[var(--bs-text)] group-hover:text-[var(--bs-accent-strong)] min-[641px]:text-[1.26rem]">
                {step.title}
              </strong>
              <small className="leading-[1.62] text-[var(--bs-muted)]">{step.detail}</small>
            </span>
          </a>
        ))}
      </div>

      <div
        aria-label="Documentation coverage"
        className="relative z-[1] col-span-full flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-[var(--bs-line)] pt-5 text-[var(--bs-muted)] min-[641px]:items-center"
      >
        <strong className="basis-full text-[var(--bs-text)] min-[641px]:mr-2 min-[641px]:basis-auto">
          Manual pages cover
        </strong>
        {docsCoverage.map((item, index) => (
          <span
            className="inline-flex min-h-[1.8rem] items-center rounded-full border border-[var(--bs-line)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1 text-[0.86rem] leading-tight text-[var(--bs-muted-strong)] data-[accent=true]:border-[color-mix(in_srgb,var(--bs-accent)_42%,var(--bs-line))] data-[accent=true]:text-[var(--bs-accent-strong)]"
            data-accent={index % 3 === 1}
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
