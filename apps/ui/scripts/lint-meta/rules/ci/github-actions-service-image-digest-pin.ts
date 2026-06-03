import { readFileSync } from "node:fs";

import type { IMetaRule, IViolation } from "../../types";

const IMAGE_LINE_REGEX = /^\s+image:\s*(?<image>[^\s#]+)/u;

/*
 * Line-based scan (same pragmatic idiom as github-actions-timeout-required):
 * `image:` keys in workflow files only appear on service containers and
 * job-level `container:` blocks, both of which pull from a registry on every
 * CI run. A mutable tag re-resolves each time — the same supply-chain hole
 * dockerfile-base-image-sha-pin closes for Dockerfiles — so require a
 * @sha256 digest, and reject `latest@sha256` (the digest wins, but the tag
 * misdocuments what is pinned and invites copy-paste without the digest).
 */
export function checkWorkflowServiceImageDigestPin(file: string): IViolation[] {
  const violations: IViolation[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    const image = IMAGE_LINE_REGEX.exec(line)?.groups?.image;

    if (image === undefined) {
      continue;
    }

    if (!image.includes("@sha256:")) {
      violations.push({
        file,
        rule: "github-actions-service-image-digest-pin",
        message: `image: ${image} (line ${String(index + 1)}) must pin the container image by @sha256 digest.`
      });
      continue;
    }

    if (image.includes(":latest@sha256:")) {
      violations.push({
        file,
        rule: "github-actions-service-image-digest-pin",
        message: `image: ${image} (line ${String(index + 1)}) mixes the floating :latest tag with a digest — use the concrete version tag the digest resolves to.`
      });
    }
  }

  return violations;
}

/**
 * Service/container images in workflows are pulled fresh on every CI run;
 * tag-only references let a mutated upstream tag execute inside PR
 * validation. Same defect class as dockerfile-base-image-sha-pin.
 */
export const githubActionsServiceImageDigestPinRule: IMetaRule = {
  id: "github-actions-service-image-digest-pin",
  category: "ci",
  description:
    "Workflow service/container images must be pinned by @sha256 digest, not tag alone.",
  run({ workflowFiles }) {
    return workflowFiles.flatMap(checkWorkflowServiceImageDigestPin);
  }
};
