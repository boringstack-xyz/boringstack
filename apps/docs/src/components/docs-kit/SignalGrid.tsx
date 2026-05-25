interface SignalItem {
  label?: string;
  title: string;
  body: string;
}

interface SignalGridProps {
  items: SignalItem[];
  columns?: 2 | 3 | 4;
}

const columnClasses = {
  2: "min-[760px]:grid-cols-2",
  3: "min-[760px]:grid-cols-3",
  4: "min-[760px]:grid-cols-2 min-[1120px]:grid-cols-4",
};

export default function SignalGrid({ items, columns = 3 }: SignalGridProps) {
  return (
    <section className={`not-content my-8 grid gap-3 ${columnClasses[columns]}`}>
      {items.map((item, index) => (
        <article
          className="group relative overflow-hidden rounded-lg border border-[var(--bs-doc-line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--sl-color-accent)_6%,transparent),transparent_6rem),var(--bs-doc-panel)] p-4 transition-colors hover:border-[var(--bs-doc-line-strong)]"
          key={`${item.title}-${index}`}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,var(--sl-color-accent),transparent)] opacity-50 transition-opacity group-hover:opacity-90" />
          {item.label ? (
            <p className="m-0 font-mono text-[0.72rem] font-black uppercase leading-none text-[var(--sl-color-accent-high)]">
              {item.label}
            </p>
          ) : null}
          <h3 className="m-0 mt-2 text-[1.02rem] font-extrabold leading-snug text-[var(--sl-color-white)]">
            {item.title}
          </h3>
          <p className="m-0 mt-2 text-[0.9rem] leading-6 text-[var(--sl-color-gray-3)]">
            {item.body}
          </p>
        </article>
      ))}
    </section>
  );
}
