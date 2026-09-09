import { useState } from "react";

import { CodePreview } from "./CodePreview";
import { agentPrompt, githubOrg } from "./landingContent";
import { GitHubIcon } from "./LandingPrimitives";

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

  return (
    <button className={className} onClick={() => copy(value)} type="button">
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : label}
    </button>
  );
}

export function HeroSection() {
  return (
    <section
      aria-labelledby="bs-hero-title"
      className="relative grid min-h-0 grid-cols-[minmax(0,1fr)] items-center gap-[2.4rem] overflow-hidden bg-transparent px-4 py-[3rem_1rem_3.25rem] min-[641px]:gap-[clamp(2rem,5vw,5rem)] min-[641px]:px-0 min-[641px]:py-[4.5rem_0_3.5rem] lg:min-h-[min(680px,calc(100vh-6rem))] lg:grid-cols-[minmax(0,0.86fr)_minmax(27rem,1fr)]"
    >
      {/* Graph-paper wash, faded into the page so it reads as texture rather
          than a table. pointer-events-none keeps it out of the way. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-bg opacity-[0.35]" />
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
          <span className="font-normal italic text-[var(--bs-accent)]">stack</span>.
        </h1>
        <p className="mt-[1.25rem] max-w-[34rem] text-pretty text-base leading-[1.55] text-[var(--bs-muted-strong)] min-[641px]:mt-[1.15rem] min-[641px]:text-[1.05rem]">
          It ships production-grade, or it doesn&rsquo;t compile. Auth, billing,
          queues and deploys are already wired. The architecture is enforced by
          lint and CI, so what your agent writes either fits or fails the build.
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
          <div className="mono-caps mb-2">Paste this into your coding agent</div>
          <div className="flex items-stretch border border-[var(--bs-line)] bg-[color-mix(in_oklch,var(--bs-panel)_60%,transparent)]">
            <div className="flex items-center gap-2 px-3 text-[var(--bs-muted)] hairline-r">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--bs-success)]" />
              <span className="font-mono text-[11px]">&gt;</span>
            </div>
            {/* The size lives on the wrapper, not the <code>. custom.css
                resets landing code to `font-size: inherit` at a specificity
                Tailwind's text-[13px] utility cannot beat, so setting it on
                the code element itself silently did nothing. */}
            <div className="min-w-0 flex-1 px-3 py-3 font-mono text-[13px] leading-normal text-[var(--bs-text)]">
              <code>{agentPrompt}</code>
            </div>
            <CopyButton
              className="grid cursor-pointer place-items-center border-0 bg-transparent px-3 text-[var(--bs-muted)] transition-colors hairline-l hover:text-[var(--bs-accent)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--bs-accent)]"
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
          <a
            className={`${actionClass} min-[641px]:w-auto bg-transparent text-[var(--bs-muted)] hover:text-[var(--bs-text)]`}
            href={githubOrg.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="h-[1.05rem] w-[1.05rem]" />
            Star on GitHub
          </a>
        </div>

        <div
          aria-label="BoringStack shape"
          className="mt-8 grid grid-cols-1 gap-3 min-[641px]:mt-7 min-[641px]:flex min-[641px]:flex-wrap min-[641px]:gap-3"
        >
          {[
            ["UI", "React + Vite"],
            ["API", "Bun + Elysia"],
            ["Infra", "Compose"],
            ["MIT", "license"],
          ].map(([value, label]) => (
            <span
              className="inline-flex min-h-8 w-full min-w-0 items-center gap-2 border border-[var(--bs-line)] bg-[color-mix(in_oklch,var(--bs-panel)_45%,transparent)] px-3 py-1 font-mono text-[0.76rem] leading-tight text-[var(--bs-muted)] min-[641px]:w-auto"
              key={label}
            >
              <b className="font-medium text-[var(--bs-accent)]">{value}</b>
              {label}
            </span>
          ))}
        </div>
      </div>

      <CodePreview />

      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--bs-line-strong),transparent)]" />
    </section>
  );
}
