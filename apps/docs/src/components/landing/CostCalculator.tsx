import { useState } from "react";
import { columns, pricingAsOf, tiers, type TierId } from "./costData";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function CostCalculator() {
  const [activeId, setActiveId] = useState<TierId>("early");
  const activeTier =
    tiers.find((t) => {
      return t.id === activeId;
    }) ?? tiers[0];
  const cheapest = Math.min(
    ...columns.map((c) => {
      return c.costs[activeId];
    }),
  );

  return (
    <section
      aria-labelledby="cost-calc-title"
      className="not-content my-10 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--sl-color-accent)_38%,var(--bs-doc-line))] bg-[var(--bs-doc-panel)] shadow-[0_24px_64px_color-mix(in_srgb,var(--bs-doc-glow)_44%,transparent)]"
    >
      <header className="grid gap-3 border-b border-[var(--bs-doc-line)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--sl-color-accent)_8%,transparent),transparent_70%)] px-5 py-5 min-[640px]:px-6 min-[640px]:py-6">
        <p className="m-0 text-[0.72rem] font-black uppercase leading-none tracking-[0.04em] text-[var(--sl-color-accent)]">
          Monthly cost across stages
        </p>
        <h3
          id="cost-calc-title"
          className="m-0 text-[1.35rem] font-extrabold leading-tight text-[var(--sl-color-white)] min-[640px]:text-[1.55rem]"
        >
          Monthly infra cost by tier
        </h3>
        <p className="m-0 max-w-[52rem] text-[0.95rem] leading-[1.55] text-[color-mix(in_srgb,var(--sl-color-text)_82%,var(--sl-color-gray-3))]">
          Select a traffic tier. The three columns are solution categories (not named vendors),
          using public rate cards as of {pricingAsOf}. See the methodology page for assumptions and
          math.
        </p>
      </header>

      <div className="grid gap-5 px-5 py-5 min-[640px]:px-6 min-[640px]:py-6">
        <div role="tablist" aria-label="Pick a usage tier" className="flex flex-wrap gap-2">
          {tiers.map((t) => {
            const selected = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="cost-calc-grid"
                onClick={() => {
                  setActiveId(t.id);
                }}
                className={
                  selected
                    ? "rounded-full border border-[var(--sl-color-accent)] bg-[var(--sl-color-accent-low)] px-3.5 py-1.5 text-[0.86rem] font-bold text-[var(--sl-color-accent-high)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sl-color-accent)]"
                    : "rounded-full border border-[var(--bs-doc-line)] bg-transparent px-3.5 py-1.5 text-[0.86rem] font-bold text-[color-mix(in_srgb,var(--sl-color-gray-2)_85%,var(--sl-color-white))] transition-colors hover:border-[color-mix(in_srgb,var(--sl-color-accent)_55%,var(--bs-doc-line))] hover:text-[var(--sl-color-white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sl-color-accent)]"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div
          aria-label="Selected tier assumptions"
          className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--bs-doc-line)] bg-[var(--bs-doc-panel-strong)] px-4 py-3 min-[640px]:grid-cols-4"
        >
          {[
            { label: "MAU", value: activeTier.mau },
            { label: "req / day", value: activeTier.reqPerDay },
            { label: "egress", value: activeTier.egress },
            { label: "DB storage", value: activeTier.dbStorage },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="m-0 font-mono text-[0.7rem] font-bold uppercase leading-none tracking-[0.04em] text-[var(--sl-color-gray-3)]">
                {stat.label}
              </p>
              <p className="m-0 mt-1 font-mono text-[1rem] font-bold leading-tight text-[var(--sl-color-accent-high)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <p className="m-0 -mt-2 text-[0.82rem] italic text-[color-mix(in_srgb,var(--sl-color-text)_70%,var(--sl-color-gray-3))]">
          {activeTier.blurb}
        </p>

        <div
          id="cost-calc-grid"
          role="tabpanel"
          aria-label={`Costs at ${activeTier.label} tier`}
          aria-live="polite"
          aria-atomic="true"
          className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-3"
        >
          {columns.map((col) => {
            const cost = col.costs[activeId];
            const multiple = cost / cheapest;
            return (
              <article
                key={col.id}
                className={
                  col.highlight
                    ? "relative grid gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--sl-color-accent)_56%,transparent)] bg-[color-mix(in_srgb,var(--sl-color-accent)_8%,var(--bs-doc-panel-strong))] px-4 py-4"
                    : "relative grid gap-2.5 rounded-lg border border-[var(--bs-doc-line)] bg-[var(--bs-doc-panel-strong)] px-4 py-4"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="m-0 text-[0.86rem] font-extrabold leading-tight text-[var(--sl-color-white)]">
                    {col.label}
                  </p>
                  {multiple > 1.05 && (
                    <span className="font-mono text-[0.7rem] font-bold text-[color-mix(in_srgb,var(--sl-color-text)_55%,var(--sl-color-gray-3))]">
                      {multiple.toFixed(multiple >= 10 ? 0 : 1)}&times;
                    </span>
                  )}
                </div>
                <p className="m-0 font-mono text-[0.72rem] uppercase leading-none tracking-[0.03em] text-[var(--sl-color-gray-3)]">
                  {col.shorthand}
                </p>
                <p
                  className={
                    col.highlight
                      ? "m-0 font-mono text-[1.85rem] font-extrabold leading-none text-[var(--sl-color-accent-high)]"
                      : "m-0 font-mono text-[1.85rem] font-extrabold leading-none text-[var(--sl-color-white)]"
                  }
                >
                  {usd.format(cost)}
                  <span className="ml-1 text-[0.78rem] font-bold text-[var(--sl-color-gray-3)]">
                    / mo
                  </span>
                </p>
                <p className="m-0 text-[0.85rem] leading-[1.5] text-[color-mix(in_srgb,var(--sl-color-text)_78%,var(--sl-color-gray-3))]">
                  {col.tradeOff}
                </p>
              </article>
            );
          })}
        </div>

        <p className="m-0 text-[0.78rem] leading-[1.5] text-[color-mix(in_srgb,var(--sl-color-text)_60%,var(--sl-color-gray-3))]">
          Prices as of {pricingAsOf}. Every figure rounded; comparisons use
          public list-price rate cards, not enterprise negotiations. See the
          {" "}
          <a className="underline" href="/reference/cost-methodology/">
            cost methodology page
          </a>{" "}
          for the math, the assumptions, and the citations.
        </p>
      </div>
    </section>
  );
}
