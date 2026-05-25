import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const GENERATED_ARTIFACTS = [
  {
    file: join("src", "lib", "acl", "acl.types.generated.ts"),
    requiredSnippets: ["AUTO-GENERATED", "generate:acl-types"]
  },
  {
    file: join("src", "lib", "api", "schema.d.ts"),
    requiredSnippets: ["DO NOT EDIT", "generate:api"]
  }
] as const;

export function checkGeneratedArtifactContracts(root: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const artifact of GENERATED_ARTIFACTS) {
    const fullPath = join(root, artifact.file);

    if (!existsSync(fullPath)) {
      violations.push({
        file: fullPath,
        rule: "generated-artifact-contract",
        message:
          "Generated artifact file is missing — run the generator and commit."
      });
      continue;
    }

    const content = readFileSync(fullPath, "utf8");

    for (const snippet of artifact.requiredSnippets) {
      if (!content.includes(snippet)) {
        violations.push({
          file: fullPath,
          rule: "generated-artifact-contract",
          message: `Generated artifact is missing required banner text \`${snippet}\`. Regenerate and commit.`
        });
      }
    }
  }

  return violations;
}

/** Generated files must exist and carry their DO NOT EDIT / AUTO-GENERATED banners. */
export const generatedArtifactContractRule: IMetaRule = {
  id: "generated-artifact-contract",
  category: "artifacts",
  description:
    "Generated ACL types and OpenAPI schema files must exist with required banner text.",
  run({ root }) {
    return checkGeneratedArtifactContracts(root);
  }
};
