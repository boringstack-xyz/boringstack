import { CodePreview } from "./CodePreview";
import { githubOrg } from "./landingContent";
import { Eyebrow, GitHubIcon } from "./LandingPrimitives";

const actionClass =
  "flex min-h-[3.15rem] w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--bs-line-strong)] px-5 py-3 font-bold leading-tight no-underline transition-colors hover:border-[color-mix(in_srgb,var(--bs-accent)_62%,transparent)] hover:bg-[var(--bs-accent-low)]";

export function HeroSection() {
  return (
    <section
      aria-labelledby="bs-hero-title"
      className="relative grid min-h-0 grid-cols-[minmax(0,1fr)] items-center gap-[2.4rem] overflow-hidden bg-transparent px-4 py-[3rem_1rem_3.25rem] min-[641px]:gap-[clamp(2rem,5vw,5rem)] min-[641px]:bg-[radial-gradient(ellipse_at_66%_34%,rgba(74,222,128,0.075),transparent_30rem),radial-gradient(ellipse_at_88%_64%,rgba(134,239,172,0.03),transparent_34rem)] min-[641px]:px-0 min-[641px]:py-[4rem_0_3.25rem] lg:min-h-[min(680px,calc(100vh-6rem))] lg:grid-cols-[minmax(0,0.72fr)_minmax(30rem,1.12fr)]"
    >
      <div className="relative z-[1] w-full min-w-0 max-w-full">
        <Eyebrow>Open source</Eyebrow>
        <h1
          className="mt-[0.55rem] max-w-[38rem] text-balance text-[2.45rem] leading-[1.08] tracking-[-0.02em] text-[var(--bs-text)] min-[421px]:text-[2.65rem] min-[641px]:text-[3.25rem] lg:text-[3.75rem]"
          id="bs-hero-title"
        >
          Production-ready from the first template clone.
        </h1>
        <p className="mt-[1.25rem] max-w-[34rem] text-pretty text-base leading-[1.55] text-[var(--bs-muted-strong)] min-[641px]:mt-[1.15rem] min-[641px]:text-[1.05rem]">
          A GitHub template repository for the full stack. Click <b>Use this template</b>, boot with compose/dev.sh, deploy on Compose.
        </p>

        <div aria-label="Primary actions" className="mt-9 grid w-full max-w-full gap-3 min-[641px]:mt-[2.1rem] min-[641px]:w-[min(100%,30rem)] min-[641px]:gap-[0.65rem]">
          <a className={`${actionClass} bg-[var(--bs-accent)] text-[var(--bs-accent-ink)] hover:bg-[var(--bs-accent-strong)]`} href="/quickstart/">
            Quickstart
          </a>
          <a
            className={`${actionClass} bg-[rgba(255,255,255,0.025)] text-[var(--bs-text)]`}
            href={githubOrg.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon className="h-[1.05rem] w-[1.05rem]" />
            View on GitHub
          </a>
          <a className={`${actionClass} bg-transparent text-[var(--bs-muted-strong)] hover:text-[var(--bs-text)]`} href="/architecture/why-boringstack/">
            Why BoringStack
          </a>
        </div>

        <div aria-label="BoringStack shape" className="mt-8 grid grid-cols-1 gap-3 min-[641px]:mt-7 min-[641px]:flex min-[641px]:flex-wrap min-[641px]:gap-3">
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
