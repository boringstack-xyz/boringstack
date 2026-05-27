import clsx from "clsx";
import { Children } from "react";
import type { ReactNode } from "react";

import { LinkedInIcon } from "../landing/LandingPrimitives";

interface PageIntroAction {
  label: string;
  href: string;
  icon?: "linkedin";
  primary?: boolean;
}

interface PageIntroFact {
  label: string;
  value: string;
}

interface PageIntroProps {
  eyebrow?: string;
  children: ReactNode;
  actions?: PageIntroAction[];
  facts?: PageIntroFact[];
}

export default function PageIntro({ eyebrow, children, actions = [], facts = [] }: PageIntroProps) {
  const content = Children.toArray(children);
  const primaryIndex = actions.findIndex((action) => action.primary) ?? 0;

  return (
    <section className="not-content my-8 overflow-hidden rounded-xl border border-transparent bg-[linear-gradient(var(--bs-doc-panel),var(--bs-doc-panel))_padding-box,linear-gradient(135deg,color-mix(in_srgb,var(--sl-color-accent)_66%,transparent),color-mix(in_srgb,var(--bs-doc-cyan)_24%,transparent),color-mix(in_srgb,var(--bs-doc-pink)_30%,transparent))_border-box] shadow-[0_24px_72px_color-mix(in_srgb,var(--bs-doc-glow)_58%,transparent)]">
      <div className="relative grid gap-7 p-5 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_8%_0%,color-mix(in_srgb,var(--sl-color-accent)_18%,transparent),transparent_17rem),linear-gradient(90deg,color-mix(in_srgb,var(--sl-color-accent)_9%,transparent),transparent_42%)] before:opacity-80 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:p-6">
        <div className="relative min-w-0">
          {eyebrow ? (
            <p className="m-0 text-[0.72rem] font-black uppercase leading-none text-[var(--sl-color-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-3 max-w-[62rem] text-[1.04rem] leading-8 text-[color-mix(in_srgb,var(--sl-color-text)_86%,var(--sl-color-gray-3))]">
            {content}
          </div>
          {actions.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <a
                  className={clsx(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-extrabold no-underline transition-colors",
                    index === (primaryIndex >= 0 ? primaryIndex : 0)
                      ? "border-transparent bg-[var(--sl-color-accent)] text-[var(--sl-color-accent-ink)] hover:bg-[var(--sl-color-accent-high)]"
                      : "border-[var(--bs-doc-line-strong)] bg-white/[0.025] text-[var(--sl-color-white)] hover:border-[var(--sl-color-accent)]",
                  )}
                  href={action.href}
                  key={`${action.label}-${action.href}`}
                  rel={action.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  target={action.href.startsWith("http") ? "_blank" : undefined}
                >
                  {action.icon === "linkedin" ? (
                    <LinkedInIcon className="h-[1rem] w-[1rem]" />
                  ) : null}
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {facts.length ? (
          <div className="relative grid min-w-[13rem] content-start gap-2 border-t border-[var(--bs-doc-line)] pt-4 min-[760px]:border-l min-[760px]:border-t-0 min-[760px]:pl-5 min-[760px]:pt-0">
            {facts.map((fact) => (
              <div
                className="rounded-lg border border-[var(--bs-doc-line)] bg-[var(--bs-doc-panel-strong)] px-3 py-2"
                key={`${fact.label}-${fact.value}`}
              >
                <p className="m-0 font-mono text-[0.72rem] font-bold text-[var(--sl-color-accent-high)]">
                  {fact.value}
                </p>
                <p className="m-0 mt-0.5 text-[0.76rem] leading-snug text-[var(--sl-color-gray-3)]">
                  {fact.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
