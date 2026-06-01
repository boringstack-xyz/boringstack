import DataMatrix from "./DataMatrix";
import lintMetaCatalog from "../../data/lint-meta-catalog.json";

interface LintMetaCatalogProps {
  template: "ui" | "api";
}

interface RuleRow {
  id: string;
  category: string;
  ciCritical: boolean;
  description: string;
}

export default function LintMetaCatalog({ template }: LintMetaCatalogProps) {
  const rules = lintMetaCatalog[template] as RuleRow[] | undefined;

  if (rules === undefined) {
    throw new Error(
      `LintMetaCatalog: no entry for template "${template}" in lint-meta-catalog.json — regenerate with \`bun run generate:lint-meta-docs\`.`,
    );
  }

  const categories = [...new Set(rules.map((rule) => rule.category))];

  return (
    <div className="not-content space-y-8">
      {categories.map((category) => {
        const rows = rules.filter((rule) => rule.category === category);

        return (
          <DataMatrix
            caption={`${template}-template · ${category}`}
            columns={["Rule ID", "CI-critical", "What it guards"]}
            highlightColumn={2}
            key={category}
            rows={rows.map((rule) => ({
              label: rule.id,
              cells: [
                <code>{rule.id}</code>,
                rule.ciCritical ? "yes" : "no",
                rule.description,
              ],
            }))}
          />
        );
      })}
    </div>
  );
}
