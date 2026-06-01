import DataMatrix from "./DataMatrix";
import scriptsCatalog from "../../data/scripts-catalog.json";

interface ScriptsCatalogProps {
  template: "ui" | "api";
}

interface FolderRow {
  folder: string;
  purpose: string;
}

interface CommandRow {
  command: string;
  script: string;
  description: string;
  invocation: string;
}

interface ManualRow {
  task: string;
  script: string;
  description: string;
}

interface TemplateCatalog {
  template: string;
  runner: string;
  folders: FolderRow[];
  commands: CommandRow[];
  manual: ManualRow[];
  prePushStages: string[];
}

export default function ScriptsCatalog({ template }: ScriptsCatalogProps) {
  const catalog = scriptsCatalog[template] as TemplateCatalog | undefined;

  if (catalog === undefined) {
    throw new Error(
      `ScriptsCatalog: no entry for template "${template}" in scripts-catalog.json — regenerate with \`bun run generate:scripts-docs\`.`,
    );
  }

  return (
    <div className="not-content space-y-8">
      <DataMatrix
        caption={`${catalog.template} · scripts folders`}
        columns={["Folder", "Purpose"]}
        rows={catalog.folders.map((folder) => ({
          label: folder.folder,
          cells: [<code>{folder.folder}</code>, folder.purpose],
        }))}
      />

      <DataMatrix
        caption={`${catalog.template} · command map`}
        columns={["Command", "Script", "Purpose"]}
        highlightColumn={2}
        rows={catalog.commands.map((entry) => ({
          label: entry.command,
          cells: [
            <code>
              {catalog.runner} {entry.command}
            </code>,
            <code>{entry.script}</code>,
            entry.description || entry.invocation,
          ],
        }))}
      />

      {catalog.manual.length > 0 ? (
        <DataMatrix
          caption={`${catalog.template} · operator scripts`}
          columns={["Task", "Script", "Notes"]}
          rows={catalog.manual.map((entry) => ({
            label: entry.task,
            cells: [
              entry.task,
              <code>{entry.script}</code>,
              entry.description || "Run manually when auditing repo settings.",
            ],
          }))}
        />
      ) : null}

      {catalog.prePushStages.length > 0 ? (
        <figure className="rounded-xl border border-[var(--bs-doc-line)] bg-[var(--bs-doc-panel)] p-4">
          <figcaption className="mb-3 font-mono text-[0.74rem] font-black uppercase text-[var(--sl-color-accent-high)]">
            {catalog.template} · pre-push stages
          </figcaption>
          <ol className="list-decimal space-y-2 pl-5 text-[0.92rem] leading-6 text-[var(--sl-color-gray-3)]">
            {catalog.prePushStages.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        </figure>
      ) : null}
    </div>
  );
}
