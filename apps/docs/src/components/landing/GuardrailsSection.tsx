import { guardrailRows } from "./landingContent";
import { Eyebrow } from "./LandingPrimitives";

/**
 * The objection this page has to answer: an agent can scaffold something
 * bespoke in minutes, so why start from someone else's template?
 *
 * Two columns, because the argument is a comparison. Left is what a generated
 * build gives you; right is the mechanism that catches it here. Every
 * right-hand cell names something real and greppable in the repo. Keep it
 * that way: if a row can't be pointed at, it doesn't belong here.
 *
 * This deliberately does NOT use SectionHeading. That primitive caps its title
 * at 13ch and scales to 4rem, which suits a short noun phrase; the claim here
 * is a full sentence and rendered as four enormous wrapped lines with a column
 * of dead space beside it. The heading spans the full width instead, so the
 * comparison starts as a comparison.
 */
export function GuardrailsSection() {
  return (
    <section
      aria-labelledby="bs-guardrails-title"
      className="mt-14 min-[641px]:mt-[clamp(5.5rem,8vw,7rem)]"
    >
      <div className="max-w-[46rem]">
        <Eyebrow>Why not just generate it</Eyebrow>
        <h2
          className="mt-[0.45rem] text-balance text-[1.95rem] leading-[1.12] tracking-[-0.015em] text-[var(--bs-text)] min-[641px]:text-[2.5rem] lg:text-[2.9rem]"
          id="bs-guardrails-title"
        >
          Your agent can write the code. It can&rsquo;t invent the guardrails.
        </h2>
        <p className="mt-4 max-w-[42rem] text-[1.02rem] leading-[1.65] text-[var(--bs-muted)]">
          Generating a working app is the easy half, and agents are good at it.
          The hard half is everything that has to stay true afterwards: tenant
          isolation, idempotent retries, a contract between server and client
          that can&rsquo;t quietly drift. A generated build has no opinion about
          any of it, so nothing tells you when it breaks. Here the rules are
          machine-checked, so wrong-shaped code fails the build instead of
          shipping and looking fine.
        </p>
      </div>

      <div
        aria-label="Generated bespoke compared with BoringStack"
        className="mt-9 max-w-[72rem] min-[641px]:mt-11"
      >
        <div className="grid grid-cols-1 gap-2 pb-3 font-mono text-[0.76rem] font-extrabold uppercase leading-tight tracking-wide text-[var(--bs-accent-strong)] min-[641px]:grid-cols-[minmax(11rem,0.28fr)_minmax(0,1fr)] min-[641px]:gap-10">
          <span>Generated bespoke</span>
          <span>Caught here, mechanically</span>
        </div>

        {guardrailRows.map((row) => (
          <div
            className="grid grid-cols-1 items-baseline gap-1 border-t border-[var(--bs-line)] py-[0.95rem] min-[641px]:grid-cols-[minmax(11rem,0.28fr)_minmax(0,1fr)] min-[641px]:gap-10"
            key={row.bespoke}
          >
            <span className="text-[0.92rem] leading-snug text-[var(--bs-muted)]">
              {row.bespoke}
            </span>
            <strong className="max-w-[52rem] text-[0.98rem] font-bold leading-[1.5] text-[var(--bs-text)] min-[641px]:text-[1.04rem]">
              {row.boringstack}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
