import clsx from "clsx";
import type React from "react";
import { useId, useState } from "react";

import { codeTabs, type CodeLine } from "./landingContent";

const tabBaseClass =
  "relative m-0 flex min-h-[3.35rem] cursor-pointer items-center justify-center whitespace-nowrap border-0 border-b-2 border-[var(--bs-line-strong)] bg-transparent px-4 py-0 text-center font-mono text-[0.76rem] font-medium leading-tight text-[var(--bs-muted)] outline-none transition-colors data-[active=true]:border-[var(--bs-accent)] data-[active=true]:text-[var(--bs-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--bs-accent)] min-[641px]:px-[1.1rem] min-[641px]:text-[0.8rem]";

const panelClass =
  "!mt-0 grid min-h-0 gap-[0.24rem] overflow-x-auto bg-[color-mix(in_oklch,var(--bs-bg)_60%,transparent)] p-4 font-mono text-[0.8rem] leading-[1.6] text-[var(--bs-code)] min-[641px]:h-[19rem] min-[641px]:p-[1.25rem_1.35rem] min-[641px]:text-[0.8rem]";

/*
 * Every line is a real block element, and every gutter glyph carries a
 * trailing space in the text stream.
 *
 * These were `<span className="block">` with the glyph flush against the
 * text. `block` is a Tailwind class, so an agent converting the page to
 * text has no CSS and reads a `<span>` as inline: the whole transcript
 * collapsed into one run and the `ok` gutter of the next line fused onto
 * the end of the previous one. The command came out as
 * `--project acmeok`, on the one element of the page an agent is most
 * likely to copy. `<div>` is a line break by tag name, with no CSS
 * needed; the panel is a grid, so the layout is unchanged.
 */
function CodeLineView({ line }: { line: CodeLine }) {
  if (line.kind === "spacer") {
    return <div aria-hidden="true" className="h-[0.7rem]" />;
  }

  if (line.kind === "command") {
    return (
      <div className="whitespace-nowrap">
        <span className="inline-flex w-[2.45rem] font-extrabold text-[#e6c26f]">{"$ "}</span>
        {line.text}
      </div>
    );
  }

  if (line.kind === "ok") {
    return (
      <div className="whitespace-nowrap">
        <span className="inline-flex w-[2.45rem] font-extrabold text-[var(--bs-success)]">
          {"ok "}
        </span>
        {line.text}
      </div>
    );
  }

  return <div className="whitespace-nowrap text-[#7f8c86]">{line.text}</div>;
}

export function CodePreview() {
  const [activeTabId, setActiveTabId] = useState(codeTabs[0].id);
  const idPrefix = useId();
  const activeTab = codeTabs.find((tab) => tab.id === activeTabId) ?? codeTabs[0];

  /*
   * role="tablist" with a roving tabIndex is only half the WAI-ARIA pattern:
   * once focus is on the strip, Left/Right (plus Home/End) have to move
   * between tabs, because only one of them is reachable by Tab. Without this
   * a keyboard user could reach the first tab and no other.
   *
   * Selection follows focus, which is the recommended behaviour when
   * switching panels is cheap; these panels are static text.
   */
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const index = codeTabs.findIndex((tab) => tab.id === activeTabId);

    let next: number | undefined;
    if (event.key in deltas) {
      next = (index + deltas[event.key] + codeTabs.length) % codeTabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = codeTabs.length - 1;
    }
    if (next === undefined) return;

    event.preventDefault();
    const target = codeTabs[next];
    setActiveTabId(target.id);
    document.getElementById(`${idPrefix}-tab-${target.id}`)?.focus();
  };

  return (
    <div className="bs-hero-code relative z-[1] mt-[0.4rem] w-full min-w-0 max-w-full lg:mt-0">
      <div
        className="overflow-hidden border border-[var(--bs-line)] bg-[color-mix(in_oklch,var(--bs-panel)_70%,transparent)]"
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
              onKeyDown={onTabKeyDown}
              role="tab"
              tabIndex={activeTabId === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/*
          tabIndex={0} is required, not optional. panelClass sets
          overflow-x-auto, and the agent transcript's lines are wide enough to
          actually scroll, which trips axe's scrollable-region-focusable: a
          keyboard user could not reach the hidden content. It is also standard
          ARIA practice for a tabpanel whose content has no other focus stop.
        */}
        <div
          aria-labelledby={`${idPrefix}-tab-${activeTab.id}`}
          className={panelClass}
          id={`${idPrefix}-${activeTab.id}`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab.lines.map((line, index) => (
            <CodeLineView key={`${activeTab.id}-${index}`} line={line} />
          ))}
        </div>
      </div>

      <p className="mx-0 mt-4 max-w-full text-left text-[0.95rem] leading-normal text-[var(--bs-muted)] min-[641px]:mx-auto min-[641px]:max-w-[44rem] min-[641px]:text-center">
        {activeTab.caption}
      </p>
    </div>
  );
}
