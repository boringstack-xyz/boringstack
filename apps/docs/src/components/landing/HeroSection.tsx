import { useState } from "react";

import { CodePreview } from "./CodePreview";
import { agentPrompt, githubOrg } from "./landingContent";
import { Eyebrow, GitHubIcon } from "./LandingPrimitives";

const actionClass =
  "flex min-h-[3.15rem] w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--bs-line-strong)] px-5 py-3 font-bold leading-tight no-underline transition-colors hover:border-[color-mix(in_srgb,var(--bs-accent)_62%,transparent)] hover:bg-[var(--bs-accent-low)]";

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
      className="relative grid min-h-0 grid-cols-[minmax(0,1fr)] items-center gap-[2.4rem] overflow-hidden bg-transparent px-4 py-[3rem_1rem_3.25rem] min-[641px]:gap-[clamp(2rem,5vw,5rem)] min-[641px]:bg-[radial-gradient(ellipse_at_66%_34%,rgba(74,222,128,0.075),transparent_30rem),radial-gradient(ellipse_at_88%_64%,rgba(134,239,172,0.03),transparent_34rem)] min-[641px]:px-0 min-[641px]:py-[4rem_0_3.25rem] lg:min-h-[min(680px,calc(100vh-6rem))] lg:grid-cols-[minmax(0,0.72fr)_minmax(30rem,1.12fr)]"
    >
      <div className="relative z-[1] w-full min-w-0 max-w-full">
        <Eyebrow>Agent-first &middot; Open source &middot; MIT</Eyebrow>
        <h1
          className="mt-[0.55rem] max-w-[38rem] text-balance text-[2.45rem] leading-[1.08] tracking-[-0.02em] text-[var(--bs-text)] min-[421px]:text-[2.65rem] min-[641px]:text-[3.25rem] lg:text-[3.75rem]"
          id="bs-hero-title"
        >
          Point your agent at this stack.
        </h1>
        <p className="mt-[1.25rem] max-w-[34rem] text-pretty text-base leading-[1.55] text-[var(--bs-muted-strong)] min-[641px]:mt-[1.15rem] min-[641px]:text-[1.05rem]">
          It ships production-grade, or it doesn&rsquo;t compile. Auth, billing,
          queues and deploys are already wired. The architecture is enforced by
          lint and CI, so what your agent writes either fits or fails the build.
        </p>

        {/*
          The primary element is the prompt, not a button. The claim on this
          page is that pointing an agent at the domain is enough, so the thing
          that proves it belongs above the calls to action.
        */}
        <div className="mt-7 w-full max-w-full min-[641px]:mt-[1.9rem] min-[641px]:w-[min(100%,32rem)]">
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--bs-accent)_38%,var(--bs-line-strong))] bg-[color-mix(in_srgb,var(--bs-accent-low)_55%,transparent)] p-[0.95rem_1.1rem]">
            <p className="m-0 font-mono text-[0.7rem] font-bold uppercase leading-tight tracking-wide text-[var(--bs-accent)]">
              Paste this into your coding agent
            </p>
            <div className="mt-[0.55rem] flex items-start gap-3">
              <code className="min-w-0 flex-1 break-words font-mono text-[0.95rem] font-bold leading-snug text-[var(--bs-text)] min-[641px]:text-[1.02rem]">
                <span aria-hidden="true" className="text-[var(--bs-accent-strong)]">
                  &gt;{" "}
                </span>
                {agentPrompt}
              </code>
              <CopyButton
                className="shrink-0 cursor-pointer rounded-md border border-[var(--bs-line-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 font-sans text-[0.78rem] font-extrabold leading-tight text-[var(--bs-text)] transition-colors hover:border-[var(--bs-accent)] hover:text-[var(--bs-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bs-accent)]"
                label="Copy"
                value={agentPrompt}
              />
            </div>
          </div>

        </div>

        <div
          aria-label="Primary actions"
          className="mt-7 grid w-full max-w-full gap-3 min-[641px]:mt-[1.7rem] min-[641px]:w-[min(100%,32rem)] min-[641px]:gap-[0.65rem]"
        >
          <a
            className={`${actionClass} bg-[var(--bs-accent)] text-[var(--bs-accent-ink)] hover:bg-[var(--bs-accent-strong)]`}
            href="/quickstart/"
          >
            Quickstart
          </a>
          <a
            className={`${actionClass} bg-[rgba(255,255,255,0.025)] text-[var(--bs-text)]`}
            href="/agents.md"
          >
            Read /agents.md
          </a>
          <a
            className={`${actionClass} bg-transparent text-[var(--bs-muted-strong)] hover:text-[var(--bs-text)]`}
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
              className="inline-flex min-h-8 w-full min-w-0 items-center gap-2 rounded-full border border-[var(--bs-line)] bg-[rgba(255,255,255,0.025)] px-3 py-1 text-[0.82rem] leading-tight text-[var(--bs-muted)] min-[641px]:w-auto"
              key={label}
            >
              <b className="text-[var(--bs-accent-strong)]">{value}</b>
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
