import type { PropsWithChildren } from "react";

interface FaqItemProps {
  title: string;
  open?: boolean;
}

const itemClass =
  "group relative m-0 overflow-hidden rounded-lg border border-[var(--bs-doc-line)] bg-[color-mix(in_srgb,var(--bs-doc-panel)_54%,transparent)] p-0 shadow-none transition-colors hover:border-[var(--bs-doc-line-strong)] open:border-[color-mix(in_srgb,var(--sl-color-accent)_42%,var(--bs-doc-line))] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color-mix(in_srgb,var(--sl-color-accent)_54%,transparent)]";

const summaryClass =
  "grid min-h-[3.35rem] cursor-pointer list-none grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-3 bg-[rgba(255,255,255,0.014)] px-4 py-3 text-left text-[var(--sl-color-white)] transition-colors hover:bg-[color-mix(in_srgb,var(--sl-color-accent)_5%,transparent)] group-open:bg-[rgba(255,255,255,0.02)] [&::-webkit-details-marker]:hidden [&::marker]:content-['']";

const bodyClass =
  "border-t border-[var(--bs-doc-line)] px-4 py-3.5 text-[var(--sl-color-text)] [overflow-wrap:anywhere] [&_a]:text-[color-mix(in_srgb,var(--sl-color-accent)_74%,white)] [&_a]:underline [&_code]:rounded-md [&_code]:border [&_code]:border-[color-mix(in_srgb,var(--sl-color-accent)_34%,transparent)] [&_code]:bg-[color-mix(in_srgb,var(--sl-color-accent)_11%,transparent)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[color-mix(in_srgb,var(--sl-color-accent)_70%,white)] [&_li+li]:mt-1.5 [&_ol]:my-0 [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-0 [&_ul]:pl-5";

export default function FaqItem({ children, open = false, title }: PropsWithChildren<FaqItemProps>) {
  return (
    <details className={itemClass} open={open || undefined}>
      <summary className={summaryClass}>
        <span className="min-w-0 text-[0.98rem] font-bold leading-tight min-[760px]:text-[1.04rem]">
          {title}
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 justify-self-end text-[color-mix(in_srgb,var(--sl-color-accent)_82%,white)] transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className={bodyClass}>{children}</div>
    </details>
  );
}
