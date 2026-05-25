import clsx from "clsx";
import type { PropsWithChildren } from "react";

type Variant = "note" | "tip" | "caution" | "danger" | "contract";

interface DocCalloutProps {
  title: string;
  eyebrow?: string;
  variant?: Variant;
}

const iconPaths: Record<Variant, string> = {
  note: "M5 5.5h14M5 12h14M5 18.5h7M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
  tip: "M12 3v3m6.36.64-2.12 2.12M21 12h-3M5.64 5.64l2.12 2.12M3 12h3m3 8h6m-5-4h4m-4.5-2.8a5 5 0 1 1 7 0c-.9.86-1.5 1.8-1.5 2.8h-4c0-1-.6-1.94-1.5-2.8Z",
  caution:
    "M12 8v5m0 4h.01M10.3 3.9 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z",
  danger: "M12 9v4m0 4h.01M4.9 4.9l14.2 14.2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  contract: "M7 8h10M7 12h10M7 16h6M5 3h10l4 4v14H5V3Zm10 0v4h4",
};

const variantClass: Record<Variant, string> = {
  note: "[--callout-accent:var(--sl-color-accent)] [--callout-title:var(--sl-color-accent-high)]",
  tip: "[--callout-accent:var(--bs-doc-cyan)] [--callout-title:color-mix(in_srgb,var(--bs-doc-cyan)_76%,white)]",
  caution: "[--callout-accent:var(--bs-doc-amber)] [--callout-title:color-mix(in_srgb,var(--bs-doc-amber)_78%,white)]",
  danger: "[--callout-accent:var(--bs-doc-red)] [--callout-title:color-mix(in_srgb,var(--bs-doc-red)_74%,white)]",
  contract: "[--callout-accent:var(--bs-doc-cyan)] [--callout-title:color-mix(in_srgb,var(--bs-doc-cyan)_76%,white)]",
};

export default function DocCallout({
  children,
  eyebrow,
  title,
  variant = "note",
}: PropsWithChildren<DocCalloutProps>) {
  return (
    <aside
      className={clsx(
        "not-content relative my-6 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--callout-accent)_32%,var(--bs-doc-line))] bg-[color-mix(in_srgb,var(--bs-doc-panel)_68%,transparent)] p-4 text-[var(--sl-color-text)] shadow-none",
        "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,var(--callout-accent),transparent)] before:opacity-80",
        variantClass[variant],
      )}
    >
      <div className="relative grid grid-cols-[1.8rem_minmax(0,1fr)] gap-3">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-md border border-[color-mix(in_srgb,var(--callout-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--callout-accent)_8%,transparent)] text-[var(--callout-title)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d={iconPaths[variant]} />
          </svg>
        </span>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="m-0 text-[0.72rem] font-black uppercase leading-none text-[color-mix(in_srgb,var(--callout-title)_78%,var(--callout-accent))]">
              {eyebrow}
            </p>
          ) : null}
          <p className={clsx("m-0 text-[0.98rem] font-extrabold leading-tight text-[var(--callout-title)]", eyebrow && "mt-1")}>
            {title}
          </p>
          <div className="mt-2 leading-7 [&_a]:text-[var(--callout-title)] [&_a]:underline [&_code]:rounded-md [&_code]:border [&_code]:border-[color-mix(in_srgb,var(--callout-accent)_34%,transparent)] [&_code]:bg-[color-mix(in_srgb,var(--callout-accent)_10%,transparent)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[var(--callout-title)] [&_p]:my-0 [&_p+p]:mt-3">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}
