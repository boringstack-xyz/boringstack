import { describe, expect, test } from "bun:test";
import { YAML } from "bun";

// Invariants for the production release path. These run against the real
// `kubectl kustomize` render, so they assert what Argo will apply.
const overlay = new URL("../overlays/prod", import.meta.url).pathname;
const rendered = Bun.spawnSync(["kubectl", "kustomize", overlay]);
if (rendered.exitCode !== 0) throw new Error(rendered.stderr.toString());
const renderedText = rendered.stdout.toString();
// Rendered documents are controlled deployment fixtures, parsed only in tests.
const documents = renderedText
  .split(/^---$/m)
  .map((doc) => doc.trim())
  .filter((doc) => doc.length > 0)
  .map((doc) => YAML.parse(doc));

type Doc = (typeof documents)[number];

const resource = (kind: string, name: string): Doc => {
  const item = documents.find(
    (doc) => doc.kind === kind && doc.metadata.name === name,
  );
  if (!item) throw new Error(`Missing ${kind}/${name}`);
  return item;
};
const wave = (item: Doc) =>
  Number(item.metadata.annotations?.["argocd.argoproj.io/sync-wave"] ?? 0);
const podSpec = (item: Doc) => item.spec.template.spec;
const container = (item: Doc, name: string) => {
  const found = podSpec(item).containers.find(
    (c: { name: string }) => c.name === name,
  );
  if (!found) throw new Error(`Missing container ${name}`);
  return found;
};
const env = (item: Doc, name: string) => {
  const found = container(item, "api").env as Array<{
    name: string;
    valueFrom?: { secretKeyRef?: { name: string; key: string } };
  }>;
  return found.find((entry) => entry.name === name);
};
const images = () =>
  documents.flatMap((doc) =>
    doc.spec?.template?.spec?.containers
      ? doc.spec.template.spec.containers.map(
          (c: { image: string }) => c.image,
        )
      : [],
  );

describe("production release contracts", () => {
  test("project images are pinned by digest and no image renders as latest", () => {
    const all = images();
    expect(all.length).toBeGreaterThan(0);
    for (const image of all) {
      expect(image).not.toMatch(/:latest\b/);
      expect(image).toContain(":");
      if (image.startsWith("ghcr.io/boringstack-xyz/")) {
        expect(image).toMatch(/@sha256:[a-f0-9]{64}$/);
      }
    }
    expect(renderedText).not.toMatch(/image: \S+:latest\b/);
  });

  test("the four release images are the ones the release workflow pins", () => {
    const names = images().map((image) => image.split("@")[0]);
    expect(names).toContain("ghcr.io/boringstack-xyz/boringstack-api");
    expect(names).toContain("ghcr.io/boringstack-xyz/boringstack-migrations");
    expect(names).toContain("ghcr.io/boringstack-xyz/boringstack-ui");
    expect(names).toContain("ghcr.io/boringstack-xyz/boringstack-site");
  });

  test("the public site is prebuilt, read-only and rolls out with the UI", async () => {
    const site = resource("Deployment", "site");
    const app = container(site, "site");
    expect(app.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(app.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(podSpec(site).securityContext.runAsNonRoot).toBe(true);
    expect(wave(site)).toBe(wave(resource("Deployment", "ui")));
    expect(wave(resource("Deployment", "api"))).toBeLessThan(wave(site));
    // Tinkercaster's site crash-looped because it built at container start.
    // The image builds at image build time and only serves files at runtime.
    const dockerfile = await Bun.file(
      new URL("../../../apps/site/Dockerfile", import.meta.url),
    ).text();
    const runtime = dockerfile.slice(dockerfile.lastIndexOf("\nFROM "));
    expect(runtime).toContain("nginx");
    expect(runtime).not.toMatch(/astro build|bun run build/);
  });

  test("argocd-image-updater annotations are gone from the Application and the render", async () => {
    const application = YAML.parse(
      await Bun.file(
        new URL("../argocd/boringstack-prod.yaml", import.meta.url),
      ).text(),
    ) as { metadata: { annotations?: Record<string, string> } };
    const keys = Object.keys(application.metadata.annotations ?? {});
    expect(keys.filter((key) => key.startsWith("argocd-image-updater."))).toEqual(
      [],
    );
    expect(renderedText).not.toContain("argocd-image-updater");
  });

  test("first sync creates infrastructure before migrations, and migrations before the API", () => {
    const migration = resource("Job", "api-migrations");
    expect(migration.metadata.annotations["argocd.argoproj.io/hook"]).toBe(
      "Sync",
    );
    expect(
      wave(resource("VaultStaticSecret", "boringstack-secrets")),
    ).toBeLessThan(wave(resource("Cluster", "boringstack-db")));
    expect(wave(resource("Cluster", "boringstack-db"))).toBeLessThan(
      wave(migration),
    );
    expect(wave(resource("StatefulSet", "valkey"))).toBeLessThan(
      wave(migration),
    );
    expect(wave(migration)).toBeLessThan(wave(resource("Deployment", "api")));
    expect(wave(resource("Deployment", "api"))).toBeLessThan(
      wave(resource("Deployment", "ui")),
    );
  });

  test("the migration Job migrates only and never seeds", () => {
    const migration = resource("Job", "api-migrations");
    const pod = podSpec(migration);
    const migrate = pod.containers[0];
    expect(migrate.image).toMatch(/boringstack-migrations@sha256:/);
    const invocation = [
      ...(migrate.command ?? []),
      ...(migrate.args ?? []),
    ].join(" ");
    expect(invocation).toContain("db:migrate");
    expect(invocation).not.toMatch(/db:seed|db:prepare|seed/);
    // No app secret set: migrations need only the database connection.
    expect(migrate.envFrom).toBeUndefined();
    expect(migrate.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(migrate.volumeMounts).toContainEqual({
      name: "runtime-tmp",
      mountPath: "/tmp",
    });
  });

  test("the API runs on a read-only root with only /tmp writable", async () => {
    const api = resource("Deployment", "api");
    const pod = podSpec(api);
    const app = container(api, "api");
    expect(app.securityContext.readOnlyRootFilesystem).toBe(true);
    expect(app.securityContext.allowPrivilegeEscalation).toBe(false);
    expect(app.volumeMounts).toContainEqual({
      name: "runtime-tmp",
      mountPath: "/tmp",
    });
    expect(pod.volumes).toContainEqual({
      name: "runtime-tmp",
      emptyDir: { sizeLimit: "256Mi" },
    });
    expect(env(api, "BUN_RUNTIME_TRANSPILER_CACHE_PATH")?.value).toBe(
      "/tmp/bun-transpiler",
    );
    // The image CMD must not let bun install packages at startup.
    const dockerfile = await Bun.file(
      new URL("../../../apps/api/Dockerfile.prod", import.meta.url),
    ).text();
    expect(dockerfile).toContain(
      'CMD ["bun", "--no-install", "run", "dist/index.js"]',
    );
  });

  test("runtime client and migrations verify the database with the same CA", () => {
    const apiCa = env(resource("Deployment", "api"), "DATABASE_SSL_CA");
    const migrateEnv = container(
      resource("Job", "api-migrations"),
      "migrate",
    ).env as Array<{
      name: string;
      valueFrom?: { secretKeyRef?: { name: string; key: string } };
    }>;
    const migrationCa = migrateEnv.find(
      (entry) => entry.name === "DATABASE_SSL_CA",
    );
    expect(apiCa?.valueFrom?.secretKeyRef).toEqual({
      name: "boringstack-db-ca",
      key: "ca.crt",
    });
    expect(migrationCa?.valueFrom?.secretKeyRef).toEqual(
      apiCa?.valueFrom?.secretKeyRef,
    );
  });

  test("network policies admit the migration Job to Postgres and Prometheus to the API", () => {
    const postgresIngress = JSON.stringify(
      resource("NetworkPolicy", "postgres-network-policy").spec.ingress,
    );
    expect(postgresIngress).toContain('"app":"api-migrations"');
    const apiIngress = JSON.stringify(
      resource("NetworkPolicy", "api-network-policy").spec.ingress,
    );
    expect(apiIngress).toContain('"app.kubernetes.io/name":"prometheus"');
    expect(apiIngress).toContain('"app.kubernetes.io/name":"traefik"');
  });

  test("API disruption budget tolerates a single node drain", () => {
    const budget = resource("PodDisruptionBudget", "api-pdb");
    expect(budget.spec.maxUnavailable).toBe(1);
    expect(budget.spec.minAvailable).toBeUndefined();
  });

  test("app secrets exclude VSO's _raw copy so they never reach one env var", () => {
    const secret = resource("VaultStaticSecret", "boringstack-secrets");
    expect(secret.spec.destination.transformation.excludeRaw).toBe(true);
    expect(
      resource("VaultStaticSecret", "ghcr-registry-secret").spec.destination
        .transformation.excludeRaw,
    ).toBe(true);
  });

  test("the database and cache resist pruning and use canonical quantities", () => {
    for (const [kind, name] of [
      ["Cluster", "boringstack-db"],
      ["StatefulSet", "valkey"],
    ] as const) {
      expect(
        resource(kind, name).metadata.annotations[
          "argocd.argoproj.io/sync-options"
        ],
      ).toContain("Prune=false");
    }
    expect(renderedText).not.toContain('"1000m"');
  });
});
