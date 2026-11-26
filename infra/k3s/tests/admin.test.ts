import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { YAML } from "bun";

// The operator dashboard is LAN-only and opt-in. These invariants read the
// source manifests directly, so they run without a cluster or kubectl.
const k3sRoot = new URL("..", import.meta.url).pathname;
const adminBase = `${k3sRoot}base/admin`;

type Doc = Record<string, any>;

const readText = (path: string): string => readFileSync(path, "utf8");

const load = (path: string): Doc => YAML.parse(readText(path)) as Doc;

const adminDocs = readdirSync(adminBase)
  .filter((name) => name.endsWith(".yaml") && name !== "kustomization.yaml")
  .map((name) => ({ name, doc: load(`${adminBase}/${name}`) }));

describe("operator dashboard is LAN-only", () => {
  test("no Ingress, IngressRoute or LoadBalancer in the admin base", () => {
    for (const { name, doc } of adminDocs) {
      expect(["Ingress", "IngressRoute", "Middleware"], name).not.toContain(
        doc.kind,
      );
      if (doc.kind === "Service") {
        expect(doc.spec.type, name).toBe("ClusterIP");
      }
    }
  });

  test("the public release and the prod overlay never include the admin base", () => {
    for (const path of [
      `${k3sRoot}base/kustomization.yaml`,
      `${k3sRoot}overlays/prod/kustomization.yaml`,
    ]) {
      expect(readText(path), path).not.toContain("admin");
    }
  });

  test("admin-api accepts connections only from the admin dashboard pod", () => {
    const policy = adminDocs.find(
      ({ name }) => name === "admin-api-networkpolicy.yaml",
    )?.doc;
    expect(policy).toBeDefined();
    const sources = (policy?.spec.ingress ?? []).flatMap(
      (rule: Doc) => rule.from ?? [],
    );
    expect(sources).toEqual([
      { podSelector: { matchLabels: { app: "admin" } } },
    ]);
  });

  test("the dashboard accepts private address ranges only", () => {
    const policy = adminDocs.find(
      ({ name }) => name === "admin-networkpolicy.yaml",
    )?.doc;
    const cidrs = (policy?.spec.ingress ?? []).flatMap((rule: Doc) =>
      (rule.from ?? []).map((source: Doc) => source.ipBlock.cidr),
    );
    expect(cidrs.sort()).toEqual([
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
    ]);
  });

  test("both admin workloads run non-root with a read-only root filesystem", () => {
    for (const name of ["admin-api-deployment.yaml", "admin-deployment.yaml"]) {
      const deployment = adminDocs.find((entry) => entry.name === name)?.doc;
      expect(
        deployment?.spec.template.spec.securityContext.runAsNonRoot,
        name,
      ).toBe(true);
      const container = deployment?.spec.template.spec.containers[0];
      expect(container.securityContext.readOnlyRootFilesystem, name).toBe(true);
      expect(container.securityContext.allowPrivilegeEscalation, name).toBe(
        false,
      );
    }
  });

  test("the overlay pins the admin images and stays in the prod namespace", () => {
    const overlay = load(`${k3sRoot}overlays/admin/kustomization.yaml`);
    expect(overlay.namespace).toBe("boringstack-prod");
    const names = (overlay.images ?? []).map((image: Doc) => image.name);
    expect(names).toEqual([
      "ghcr.io/boringstack-xyz/boringstack-admin-api",
      "ghcr.io/boringstack-xyz/boringstack-admin",
    ]);
  });
});

// The overlay is rendered in CI with `kubectl kustomize`, the same as the prod
// overlay. These assert what that render contains, namespace included.
describe("operator dashboard: rendered overlay", () => {
  const rendered = Bun.spawnSync([
    "kubectl",
    "kustomize",
    `${k3sRoot}overlays/admin`,
  ]);
  if (rendered.exitCode !== 0) {
    throw new Error(rendered.stderr.toString());
  }
  const documents = rendered.stdout
    .toString()
    .split(/^---$/m)
    .filter((doc) => doc.trim() !== "")
    .map((doc) => YAML.parse(doc) as Doc);
  const names = (kind: string) =>
    documents
      .filter((doc) => doc.kind === kind)
      .map((doc) => doc.metadata?.name)
      .sort();

  test("renders both dashboard workloads and their services", () => {
    expect(names("Deployment")).toEqual(["admin", "admin-api"]);
    expect(names("Service")).toEqual(["admin", "admin-api"]);
  });

  test("renders both network policies into the prod namespace", () => {
    expect(names("NetworkPolicy")).toEqual([
      "admin-api-network-policy",
      "admin-network-policy",
    ]);
    for (const doc of documents) {
      expect(doc.metadata?.namespace, doc.metadata?.name).toBe(
        "boringstack-prod",
      );
    }
  });
});
