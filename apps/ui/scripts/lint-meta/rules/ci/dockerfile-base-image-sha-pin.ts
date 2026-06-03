import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { IMetaRule, IViolation } from "../../types";

const DOCKERFILES = ["Dockerfile", "Dockerfile.prod"];

export function checkDockerfileBaseImageShaPin(root: string): IViolation[] {
  const violations: IViolation[] = [];

  for (const dockerfile of DOCKERFILES) {
    const dockerPath = join(root, dockerfile);

    if (!existsSync(dockerPath)) {
      continue;
    }

    const lines = readFileSync(dockerPath, "utf8").split("\n");
    const stageAliases = new Set<string>();

    for (const [index, line] of lines.entries()) {
      const fromMatch =
        /^\s*FROM\s+(?<image>\S+)(?:\s+AS\s+(?<alias>\S+))?/iu.exec(line);
      const image = fromMatch?.groups?.image;

      if (image === undefined) {
        continue;
      }

      const normalized = image.toLowerCase();
      const referencesEarlierStage =
        normalized === "scratch" || stageAliases.has(normalized);

      const alias = fromMatch?.groups?.alias;

      if (alias !== undefined) {
        stageAliases.add(alias.toLowerCase());
      }

      if (referencesEarlierStage || image.includes("@sha256:")) {
        continue;
      }

      violations.push({
        file: dockerPath,
        rule: "dockerfile-base-image-sha-pin",
        message: `FROM ${image} (line ${String(index + 1)}) must pin the base image by @sha256 digest.`
      });
    }
  }

  return violations;
}

/** Every Dockerfile FROM must pin its base image by digest. */
export const dockerfileBaseImageShaPinRule: IMetaRule = {
  id: "dockerfile-base-image-sha-pin",
  category: "ci",
  description:
    "Dockerfile base images must be pinned by @sha256 digest, not tag alone.",
  run({ root }) {
    return checkDockerfileBaseImageShaPin(root);
  }
};
