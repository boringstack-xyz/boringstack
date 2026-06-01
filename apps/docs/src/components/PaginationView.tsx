interface PaginationLink {
  href: string;
  label: string;
}

interface PaginationViewProps {
  dir: "ltr" | "rtl";
  previousLabel: string;
  nextLabel: string;
  prev?: PaginationLink;
  next?: PaginationLink;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  const path =
    direction === "left"
      ? "M15 5l-7 7 7 7M8 12h12"
      : "M9 5l7 7-7 7M16 12H4";

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}

function PaginationCard({
  href,
  label,
  title,
  type,
  isRtl,
}: {
  href: string;
  label: string;
  title: string;
  type: "prev" | "next";
  isRtl: boolean;
}) {
  const arrowDirection = type === "prev" !== isRtl ? "left" : "right";
  const rel = type === "prev" ? "prev" : "next";

  return (
    <a
      className="group relative grid min-h-24 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-lg border border-[var(--bs-doc-line)] bg-[color-mix(in_srgb,var(--bs-doc-panel)_46%,transparent)] p-4 text-[var(--sl-color-text)] no-underline transition-colors hover:border-[color-mix(in_srgb,var(--sl-color-accent)_38%,var(--bs-doc-line))] hover:bg-[color-mix(in_srgb,var(--sl-color-accent)_5%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sl-color-accent)] min-[640px]:p-5"
      href={href}
      rel={rel}
    >
      <span
        className={
          type === "next"
            ? "order-2 grid h-9 w-9 place-items-center justify-self-end rounded-md border border-[var(--bs-doc-line)] text-[color-mix(in_srgb,var(--sl-color-accent)_76%,white)] transition-colors group-hover:border-[color-mix(in_srgb,var(--sl-color-accent)_46%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--sl-color-accent)_7%,transparent)] min-[640px]:order-none"
            : "grid h-9 w-9 place-items-center rounded-md border border-[var(--bs-doc-line)] text-[color-mix(in_srgb,var(--sl-color-accent)_76%,white)] transition-colors group-hover:border-[color-mix(in_srgb,var(--sl-color-accent)_46%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--sl-color-accent)_7%,transparent)]"
        }
      >
        <ArrowIcon direction={arrowDirection} />
      </span>
      <span
        className={
          type === "next"
            ? "grid min-w-0 gap-2 text-left min-[640px]:text-right"
            : "grid min-w-0 gap-2 text-left"
        }
      >
        <span className="text-[0.72rem] font-black uppercase leading-none text-[var(--sl-color-gray-3)]">
          {label}
        </span>
        <span className="min-w-0 text-balance text-[1.15rem] font-extrabold leading-tight text-[var(--sl-color-white)] min-[760px]:text-[1.35rem]">
          {title}
        </span>
      </span>
    </a>
  );
}

export default function PaginationView({
  dir,
  next,
  nextLabel,
  prev,
  previousLabel,
}: PaginationViewProps) {
  const isRtl = dir === "rtl";

  if (!prev && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Page navigation"
      className="not-content print:hidden grid grid-cols-1 gap-3 min-[760px]:grid-cols-2"
      dir={dir}
    >
      {prev ? (
        <PaginationCard
          href={prev.href}
          isRtl={isRtl}
          label={previousLabel}
          title={prev.label}
          type="prev"
        />
      ) : (
        <span aria-hidden="true" className="hidden min-[760px]:block" />
      )}
      {next ? (
        <PaginationCard
          href={next.href}
          isRtl={isRtl}
          label={nextLabel}
          title={next.label}
          type="next"
        />
      ) : null}
    </nav>
  );
}
