import { useState } from "react";

import { StackMachine } from "./StackMachine";
import { agentPrompt } from "./landingContent";

/* Sharp corners, 2.75rem tall, hairline border. tsforge's button shape. */
const actionClass =
  "group inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 border border-[var(--bs-line)] px-5 text-[13px] font-medium leading-tight tracking-tight no-underline transition-colors hover:border-[var(--bs-line-strong)]";

/**
 * Copy-to-clipboard for the prompt and the install command.
 *
 * The clipboard API is unavailable on insecure origins and can be denied by
 * permission policy, so the button reports what actually happened rather than
 * claiming success. On failure the text stays selectable, which is the
 * fallback anyway.
 */
function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };

  return { state, copy };
}

function CopyIcon({ done }: { done: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      {done ? (
        <path d="M3 8.5 6.5 12 13 4.5" />
      ) : (
        <>
          <rect height="9" rx="1" width="9" x="5.5" y="1.5" />
          <path d="M10.5 14.5H2.5a1 1 0 0 1-1-1V5.5" />
        </>
      )}
    </svg>
  );
}

function CopyButton({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  const { state, copy } = useCopy();

  /* Icon-only, so the accessible name has to carry the whole meaning and
     change with the result. A failed clipboard write says so rather than
     silently looking like success. */
  const announced =
    state === "copied"
      ? "Copied"
      : state === "failed"
        ? "Copy failed, select the text and copy manually"
        : label;

  return (
    <button
      aria-label={announced}
      className={className}
      onClick={() => copy(value)}
      title={announced}
      type="button"
    >
      <CopyIcon done={state === "copied"} />
    </button>
  );
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="bs-hero-title"
      className="relative grid min-h-0 grid-cols-[minmax(0,1fr)] items-center gap-[2.4rem] overflow-hidden bg-transparent px-4 pt-12 pb-13 min-[641px]:gap-[clamp(2rem,5vw,5rem)] min-[641px]:px-0 min-[641px]:pt-10 min-[641px]:pb-12 lg:min-h-[min(680px,calc(100vh-6rem))] lg:grid-cols-[minmax(0,0.86fr)_minmax(27rem,1fr)]"
    >
      {/* Graph-paper wash, faded into the page so it reads as texture rather
          than a table. pointer-events-none keeps it out of the way. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-bg opacity-[0.35]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--bs-bg)_35%,transparent),color-mix(in_oklch,var(--bs-bg)_70%,transparent),var(--bs-bg))]"
      />

      <div className="relative z-[1] w-full min-w-0 max-w-full">
        <div className="mb-7 flex items-center gap-3">
          <span className="h-px w-8 bg-[var(--bs-accent)]" />
          <span className="mono-caps !text-[color:var(--bs-accent)]">
            Agent-first &middot; Open source &middot; MIT
          </span>
        </div>
        <h1
          className="max-w-[34rem] text-balance font-mono text-[1.9rem] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--bs-text)] min-[421px]:text-[2.15rem] min-[641px]:text-[2.7rem] lg:text-[3.1rem]"
          id="bs-hero-title"
        >
          Point your agent at this{" "}
          <span className="font-normal italic text-[var(--bs-accent)]">
            stack
          </span>
          .
        </h1>
        <p className="mt-[1.25rem] max-w-[34rem] text-pretty text-base leading-[1.55] text-[var(--bs-muted-strong)] min-[641px]:mt-[1.15rem] min-[641px]:text-[1.05rem]">
          Auth, billing, queues, and deploys are already wired. Your agent
          builds the feature; lint and CI check that it fits the architecture.
        </p>

        {/*
          The primary element is the prompt, not a button. The claim on this
          page is that pointing an agent at the domain is enough, so the thing
          that proves it sits above the calls to action.

          Shape follows tsforge's install bar: a status cell, the command, and
          an icon-only copy button, separated by hairlines rather than nested
          boxes.
        */}
        <div className="mt-9 w-full max-w-full min-[641px]:w-[min(100%,34rem)]">
          <div className="mono-caps mb-2">
            Paste this into your coding agent
          </div>
          <div className="flex items-stretch border border-[var(--bs-line)] bg-[color-mix(in_oklch,var(--bs-panel)_60%,transparent)]">
            <div className="flex shrink-0 items-center gap-1.5 px-2.5 text-[var(--bs-muted)] hairline-r">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--bs-accent)]" />
              <span className="font-mono text-[11px] leading-none">&gt;</span>
            </div>
            {/* The size and weight live here, not on the <code>: the landing
                code reset makes the element inherit both, so setting them on
                it directly does nothing. */}
            <div className="min-w-0 flex-1 overflow-x-auto px-2.5 py-2.5 font-mono text-[13px] font-normal leading-normal text-[var(--bs-text)]">
              <code className="whitespace-nowrap">{agentPrompt}</code>
            </div>
            <CopyButton
              className="grid shrink-0 cursor-pointer place-items-center border-0 bg-transparent px-2.5 text-[var(--bs-muted)] transition-colors hairline-l hover:text-[var(--bs-accent)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--bs-accent)]"
              label="Copy"
              value={agentPrompt}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] leading-snug text-[var(--bs-muted)]">
            It reads{" "}
            <a
              className="text-[var(--bs-accent)] hover:underline"
              href="/agents.md"
            >
              /agents.md
            </a>{" "}
            and runs the installer. Five phases, no prompts.
          </p>
        </div>

        <div
          aria-label="Primary actions"
          className="mt-9 grid w-full max-w-full gap-3 min-[641px]:mt-8 min-[641px]:flex min-[641px]:w-auto min-[641px]:flex-wrap min-[641px]:items-center"
        >
          <a
            className={`${actionClass} min-[641px]:w-auto border-[var(--bs-accent)] bg-[var(--bs-accent)] text-[var(--bs-accent-ink)] hover:bg-[color-mix(in_oklch,var(--bs-accent)_90%,black)]`}
            href="/quickstart/"
          >
            Quickstart
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </a>
          <a
            className={`${actionClass} min-[641px]:w-auto bg-transparent text-[var(--bs-text)]`}
            href="/agents.md"
          >
            Read /agents.md
          </a>
        </div>

        <div className="bs-hero-tech" aria-label="Built with">
          <span>React + Vite</span>
          <span>Bun + Elysia</span>
          <span>Postgres</span>
          <span>Compose</span>
        </div>
      </div>

      <StackMachine />

      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--bs-line-strong),transparent)]" />
    </section>
  );
}
