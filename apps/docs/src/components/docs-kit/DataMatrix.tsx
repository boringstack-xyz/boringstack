import clsx from "clsx";
import type { ReactNode } from "react";

interface DataMatrixRow {
  label?: string;
  cells: ReactNode[];
}

interface DataMatrixProps {
  columns: string[];
  rows: DataMatrixRow[];
  caption?: string;
  highlightColumn?: number;
}

const gridColumnClasses: Record<number, string> = {
  2: "grid-cols-[repeat(2,minmax(11rem,1fr))]",
  3: "grid-cols-[repeat(3,minmax(11rem,1fr))]",
  4: "grid-cols-[repeat(4,minmax(11rem,1fr))]",
  5: "grid-cols-[repeat(5,minmax(11rem,1fr))]",
};

export default function DataMatrix({ columns, rows, caption, highlightColumn }: DataMatrixProps) {
  const gridColumns = gridColumnClasses[columns.length] ?? gridColumnClasses[4];

  return (
    <figure className="not-content my-8 overflow-hidden rounded-xl border border-transparent bg-[linear-gradient(var(--bs-doc-panel),var(--bs-doc-panel))_padding-box,linear-gradient(135deg,color-mix(in_srgb,var(--sl-color-accent)_54%,transparent),color-mix(in_srgb,var(--bs-doc-cyan)_26%,transparent),color-mix(in_srgb,var(--bs-doc-pink)_22%,transparent))_border-box] shadow-[0_22px_70px_color-mix(in_srgb,var(--bs-doc-glow)_54%,transparent)]">
      {caption ? (
        <figcaption className="border-b border-[var(--bs-doc-line)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sl-color-accent)_12%,transparent),transparent_62%)] px-4 py-3 font-mono text-[0.74rem] font-black uppercase text-[var(--sl-color-accent-high)]">
          {caption}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <div className={clsx("grid min-w-full", gridColumns)}>
          {columns.map((column, index) => (
            <div
              className={clsx(
                "border-b border-r border-[var(--bs-doc-line)] px-4 py-3 text-sm font-extrabold leading-snug text-[var(--sl-color-white)] last:border-r-0",
                highlightColumn === index &&
                  "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--sl-color-accent)_16%,transparent),color-mix(in_srgb,var(--sl-color-accent)_7%,transparent))]",
              )}
              key={column}
            >
              {column}
            </div>
          ))}
          {rows.flatMap((row, rowIndex) =>
            row.cells.map((cell, cellIndex) => (
              <div
                className={clsx(
                  "min-h-24 border-b border-r border-[var(--bs-doc-line)] px-4 py-4 text-[0.9rem] leading-6 text-[var(--sl-color-gray-3)] last:border-r-0",
                  rowIndex === rows.length - 1 && "border-b-0",
                  cellIndex === 0 && "font-extrabold text-[var(--sl-color-white)]",
                  highlightColumn === cellIndex &&
                    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--sl-color-accent)_12%,transparent),color-mix(in_srgb,var(--sl-color-accent)_6%,transparent))]",
                )}
                key={`${row.label ?? rowIndex}-${cellIndex}`}
              >
                {cell}
              </div>
            )),
          )}
        </div>
      </div>
    </figure>
  );
}
