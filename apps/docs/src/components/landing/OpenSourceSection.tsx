import { githubOrg } from "./landingContent";
import { GitHubIcon, SectionHeading } from "./LandingPrimitives";

const actionClass =
  "inline-flex min-h-[3.15rem] items-center justify-center gap-2 rounded-lg border border-[var(--bs-line-strong)] px-5 py-3 font-bold leading-tight no-underline transition-colors hover:border-[color-mix(in_srgb,var(--bs-accent)_62%,transparent)] hover:bg-[var(--bs-accent-low)]";

export function OpenSourceSection() {
  return (
    <section
      aria-labelledby="bs-oss-title"
      className="mt-14 min-[641px]:mt-[clamp(4.8rem,6.5vw,6rem)]"
    >
      <SectionHeading
        body="The templates, ESLint plugins, CI workflows, and this docs site are public GitHub repos. Everything is MIT-licensed. BoringStack is not a commercial product: no paid tier, no hosted runtime, no license key. Fork with Use this template and run it on your own machine or VPS."
        eyebrow="GitHub"
        id="bs-oss-title"
        title="Open source"
      />

      <div className="mt-8">
        <a
          className={`${actionClass} bg-[var(--bs-accent)] text-[var(--bs-accent-ink)] hover:bg-[var(--bs-accent-strong)]`}
          href={githubOrg.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHubIcon className="h-[1.05rem] w-[1.05rem]" />
          View on GitHub
        </a>
      </div>
    </section>
  );
}
