import { readFileSync } from "node:fs";
import { join } from "node:path";

interface IResourceNames {
  name: string;
  prefix: string;
  singular: string;
  upper: string;
}

/** Explicit tokens keep readable templates independent from source patching. */
export function renderResourceTemplate(
  root: string,
  file: string,
  names: IResourceNames
): string {
  const template = readFileSync(
    join(root, "tools/agent/generate/templates", file),
    "utf8"
  );
  const substitutions: Record<string, string> = {
    ResourcePlural: names.name,
    resourcePlural: names.prefix,
    ResourceSingular: names.singular,
    resourceSingular: names.singular.toLowerCase(),
    RESOURCE_SINGULAR: names.upper,
  };

  return template.replace(
    /ResourcePlural|resourcePlural|ResourceSingular|resourceSingular|RESOURCE_SINGULAR/g,
    (token) => {
      const replacement = substitutions[token];

      if (replacement === undefined) {
        throw new Error(`Unknown resource template token: ${token}`);
      }

      return replacement;
    }
  );
}
