import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const GENERATED_ARTIFACTS = [
  {
    file: join("..", "ui", "src", "lib", "acl", "acl.types.generated.ts"),
    requiredSnippets: ["AUTO-GENERATED", "generate:acl-types"],
  },
  {
    file: join("..", "ui", "src", "lib", "api", "schema.d.ts"),
    requiredSnippets: ["DO NOT EDIT", "generate:api"],
  },
] as const;

export function checkGeneratedArtifactContracts(root: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const artifact of GENERATED_ARTIFACTS) {
    const fullPath = join(root, artifact.file);

    if (!existsSync(fullPath)) {
      continue;
    }

    const content = readFileSync(fullPath, "utf8");

    for (const snippet of artifact.requiredSnippets) {
      if (!content.includes(snippet)) {
        violations.push({
          file: fullPath,
          rule: "generated-artifact-contract",
          message: `Generated artifact is missing required banner text \`${snippet}\`. Regenerate and commit.`,
        });
      }
    }
  }

  return violations;
}

/** apps/ui generated files must carry DO NOT EDIT / AUTO-GENERATED banners. */
export const generatedArtifactContractRule: IMetaRule = {
  id: "generated-artifact-contract",
  category: "artifacts",
  description:
    "Sibling apps/ui generated ACL and OpenAPI files must carry required banner text.",
  run({ root }) {
    return checkGeneratedArtifactContracts(root);
  },
};
