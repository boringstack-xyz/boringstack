import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

// Kubernetes injects <SERVICE>_PORT=tcp://ip:port into every pod for each
// Service in its namespace unless the pod opts out. A new Service named `api`
// or `admin` would otherwise become an env var the app might read as
// configuration. Every pod that runs this repo's images must opt out.
const FIRST_PARTY_IMAGE = "ghcr.io/boringstack-xyz/boringstack-";
const overlay = new URL("../overlays/prod", import.meta.url).pathname;
const rendered = Bun.spawnSync(["kubectl", "kustomize", overlay]);
if (rendered.exitCode !== 0) throw new Error(rendered.stderr.toString());
const documents = rendered.stdout
  .toString()
  .split(/^---$/m)
  .map((doc) => doc.trim())
  .filter((doc) => doc.length > 0)
  .map((doc) => YAML.parse(doc));

type PodSpec = {
  enableServiceLinks?: boolean;
  containers: { image: string }[];
};
type Doc = {
  kind: string;
  metadata: { name: string };
  spec?: {
    template?: { spec: PodSpec };
    jobTemplate?: { spec: { template: { spec: PodSpec } } };
  };
};

const PODS = ["Deployment", "Job", "CronJob", "StatefulSet", "DaemonSet"];
const podSpec = (doc: Doc): PodSpec | undefined =>
  doc.spec?.template?.spec ?? doc.spec?.jobTemplate?.spec.template.spec;

describe("service links", () => {
  test("every prod pod running this repo's images opts out of service-link env", () => {
    const workloads = (documents as Doc[]).filter((doc) => {
      const spec = PODS.includes(doc.kind) ? podSpec(doc) : undefined;
      return (
        spec !== undefined &&
        spec.containers.some((c) => c.image.startsWith(FIRST_PARTY_IMAGE))
      );
    });
    expect(workloads.map((doc) => `${doc.kind}/${doc.metadata.name}`).sort())
      .toEqual([
        "Deployment/api",
        "Deployment/site",
        "Deployment/ui",
        "Job/api-migrations",
      ]);
    for (const doc of workloads)
      expect(podSpec(doc)?.enableServiceLinks, doc.metadata.name).toBe(false);
  });
});
