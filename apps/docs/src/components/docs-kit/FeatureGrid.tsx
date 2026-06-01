interface FeatureItem {
  eyebrow?: string;
  title: string;
  body: string;
  href?: string;
}

interface FeatureGridProps {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
}

const columnClasses = {
  2: "min-[760px]:grid-cols-2",
  3: "min-[760px]:grid-cols-3",
  4: "min-[760px]:grid-cols-2 min-[1180px]:grid-cols-4",
};

function FeatureCard({ item, index }: { item: FeatureItem; index: number }) {
  const content = (
    <>
      <span className="font-mono text-[0.72rem] font-black text-[var(--sl-color-accent-high)]">
        {item.eyebrow ?? String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="m-0 mt-3 text-[1.05rem] font-extrabold leading-snug text-[var(--sl-color-white)]">
        {item.title}
      </h3>
      <p className="m-0 mt-2 text-[0.9rem] leading-6 text-[var(--sl-color-gray-3)]">{item.body}</p>
    </>
  );

  const className =
    "relative block min-h-full overflow-hidden rounded-lg border border-[var(--bs-doc-line)] bg-[var(--bs-doc-panel)] p-4 no-underline transition-colors before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,var(--sl-color-accent),color-mix(in_srgb,var(--bs-doc-cyan)_70%,transparent),transparent)] before:opacity-60 hover:border-[var(--bs-doc-line-strong)]";

  if (item.href) {
    return (
      <a className={className} href={item.href}>
        {content}
      </a>
    );
  }

  return <article className={className}>{content}</article>;
}

export default function FeatureGrid({ items, columns = 3 }: FeatureGridProps) {
  return (
    <section className={`not-content my-8 grid gap-3 ${columnClasses[columns]}`}>
      {items.map((item, index) => (
        <FeatureCard index={index} item={item} key={`${item.title}-${index}`} />
      ))}
    </section>
  );
}
