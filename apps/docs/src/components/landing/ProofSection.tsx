import { proofRows } from "./landingContent";
import { SectionHeading } from "./LandingPrimitives";

export function ProofSection() {
  return (
    <section
      aria-labelledby="bs-proof-title"
      className="mt-14 grid grid-cols-1 items-start gap-[clamp(2rem,5vw,5rem)] min-[641px]:mt-[clamp(5.5rem,8vw,7rem)] lg:grid-cols-[minmax(0,0.64fr)_minmax(30rem,1fr)]"
    >
      <div className="max-w-[38rem]">
        <SectionHeading
          body="Sessions, webhooks, idempotent jobs, tenant boundaries, and deploy scripts are usually added after launch pressure hits. They are in the first clone: accounts schema, Stripe hooks, BullMQ workers, Traefik overlays, and runbooks beside the code."
          eyebrow="Included in the first clone"
          id="bs-proof-title"
          title="Multi-tenant auth, billing hooks, and deploy scripts on day one."
        />
      </div>

      <div
        aria-label="What BoringStack gives you earlier"
        className="grid self-end border-y border-[var(--bs-line)] lg:mt-2"
      >
        <div className="grid grid-cols-1 gap-2 py-4 font-mono text-[0.78rem] font-extrabold leading-snug text-[var(--bs-accent-strong)] min-[641px]:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)] min-[641px]:gap-6">
          <span>Usually postponed</span>
          <span>Already in the first clone</span>
        </div>

        {proofRows.map((row) => (
          <div
            className="grid grid-cols-1 gap-2 border-t border-[var(--bs-line)] py-4 min-[641px]:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)] min-[641px]:gap-6"
            key={row.label}
          >
            <span className="font-mono text-[0.86rem] leading-snug text-[var(--bs-muted)]">
              {row.label}
            </span>
            <strong className="max-w-[44rem] text-base leading-[1.46] text-[var(--bs-text)] min-[641px]:text-[1.12rem]">
              {row.value}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
