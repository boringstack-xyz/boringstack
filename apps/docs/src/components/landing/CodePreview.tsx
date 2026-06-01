import clsx from "clsx";
import { useId, useState } from "react";

import { codeTabs, type CodeLine } from "./landingContent";

const tabBaseClass =
  "relative m-0 flex min-h-[3.35rem] cursor-pointer items-center justify-center whitespace-nowrap border-0 border-b-2 border-[var(--bs-line-strong)] bg-transparent px-4 py-0 text-center font-sans text-[0.82rem] font-extrabold leading-tight text-[var(--bs-muted)] outline-none transition-colors data-[active=true]:border-[var(--bs-accent)] data-[active=true]:text-[var(--bs-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--bs-accent)] min-[641px]:px-[1.1rem] min-[641px]:text-[0.88rem]";

const panelClass =
  "!mt-0 grid min-h-0 gap-[0.24rem] overflow-x-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent),color-mix(in_srgb,var(--bs-bg)_82%,#000_18%)] p-4 font-mono text-[0.82rem] leading-[1.55] text-[var(--bs-code)] min-[641px]:h-[18.5rem] min-[641px]:p-[1.25rem_1.35rem] min-[641px]:text-[0.94rem]";

function CodeLineView({ line }: { line: CodeLine }) {
  if (line.kind === "spacer") {
    return <span aria-hidden="true" className="h-[0.7rem]" />;
  }

  if (line.kind === "command") {
    return (
      <span className="block whitespace-nowrap">
        <span className="inline-flex w-[2.45rem] font-extrabold text-[#e6c26f]">$</span>
        {line.text}
      </span>
    );
  }

  if (line.kind === "ok") {
    return (
      <span className="block whitespace-nowrap">
        <span className="inline-flex w-[2.45rem] font-extrabold text-[var(--bs-success)]">ok</span>
        {line.text}
      </span>
    );
  }

  return <span className="block whitespace-nowrap text-[#7f8c86]">{line.text}</span>;
}

export function CodePreview() {
  const [activeTabId, setActiveTabId] = useState(codeTabs[0].id);
  const idPrefix = useId();
  const activeTab = codeTabs.find((tab) => tab.id === activeTabId) ?? codeTabs[0];

  return (
    <div className="bs-hero-code relative z-[1] mt-[0.4rem] w-full min-w-0 max-w-full lg:mt-0">
      <div
        className="overflow-hidden rounded-lg border border-[var(--bs-line-strong)] bg-[color-mix(in_srgb,var(--bs-panel)_90%,transparent)] shadow-[0_22px_60px_var(--bs-shadow)]"
        data-bs-code-preview
      >
        <div
          aria-label="BoringStack examples"
          className="!mt-0 grid auto-cols-[minmax(max-content,1fr)] grid-flow-col items-stretch overflow-x-auto"
          role="tablist"
        >
          {codeTabs.map((tab) => (
            <button
              aria-controls={`${idPrefix}-${tab.id}`}
              aria-selected={activeTabId === tab.id}
              className={clsx(tabBaseClass)}
              data-active={activeTabId === tab.id}
              id={`${idPrefix}-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              role="tab"
              tabIndex={activeTabId === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`${idPrefix}-tab-${activeTab.id}`}
          className={panelClass}
          id={`${idPrefix}-${activeTab.id}`}
          role="tabpanel"
        >
          {activeTab.lines.map((line, index) => (
            <CodeLineView key={`${activeTab.id}-${index}`} line={line} />
          ))}
        </div>
      </div>

      <p className="mx-0 mt-4 max-w-full text-left text-[0.95rem] leading-normal text-[var(--bs-muted)] min-[641px]:mx-auto min-[641px]:max-w-[44rem] min-[641px]:text-center">
        API -&gt; OpenAPI -&gt; UI, with Compose underneath and deploy docs beside the code.
      </p>
    </div>
  );
}
