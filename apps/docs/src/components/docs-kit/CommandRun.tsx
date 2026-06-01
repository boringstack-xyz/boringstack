interface OutputLine {
  tone?: "ok" | "muted" | "warn";
  text: string;
}

interface CommandRunProps {
  title?: string;
  command: string | string[];
  output?: OutputLine[];
  caption?: string;
  prompt?: string;
}

const toneClasses = {
  ok: "text-[var(--bs-doc-mint)]",
  muted: "text-[var(--bs-doc-code-muted)]",
  warn: "text-[var(--bs-doc-amber)]",
};

export default function CommandRun({ title = "Run", command, output = [], caption, prompt = "$" }: CommandRunProps) {
  const commands = Array.isArray(command) ? command : [command];

  return (
    <figure className="not-content my-8 overflow-hidden rounded-xl border border-transparent bg-[linear-gradient(var(--bs-doc-code-bg),var(--bs-doc-code-bg))_padding-box,linear-gradient(135deg,color-mix(in_srgb,var(--sl-color-accent)_72%,transparent),color-mix(in_srgb,var(--bs-doc-cyan)_30%,transparent),color-mix(in_srgb,var(--bs-doc-pink)_36%,transparent))_border-box] shadow-[0_22px_70px_color-mix(in_srgb,var(--bs-doc-glow)_64%,transparent)]">
      <figcaption className="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--bs-doc-line)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sl-color-accent)_14%,transparent),transparent_58%)] px-4 py-3">
        <span className="text-[0.76rem] font-black uppercase text-[var(--sl-color-accent-high)]">
          {title}
        </span>
        {caption ? (
          <span className="hidden min-w-0 truncate font-mono text-[0.74rem] text-[var(--sl-color-gray-3)] min-[700px]:block">
            {caption}
          </span>
        ) : null}
      </figcaption>
      <pre className="m-0 overflow-x-auto bg-[radial-gradient(circle_at_14%_0%,color-mix(in_srgb,var(--sl-color-accent)_16%,transparent),transparent_18rem)] p-4 font-mono text-[0.9rem] leading-7 text-[var(--bs-doc-code-text)]">
        <code>
          {commands.map((line, index) => (
            <span key={`${line}-${index}`}>
              <span className="text-[var(--bs-doc-amber)]">{prompt}</span> {line}
              {index < commands.length - 1 ? "\n" : ""}
            </span>
          ))}
          {output.length ? "\n\n" : ""}
          {output.map((line, index) => (
            <span className={toneClasses[line.tone ?? "muted"]} key={`${line.text}-${index}`}>
              {line.tone === "ok" ? "ok  " : line.tone === "warn" ? "!   " : "#   "}
              {line.text}
              {index < output.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
