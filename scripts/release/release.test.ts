import { describe, expect, test } from "bun:test";
import { YAML } from "bun";
import { checkRuns, expectedWorkflows, pinImages } from "./release.mjs";

const repository = "boringstack-xyz/boringstack";
const imageNames = ["api", "migrations", "ui", "site"];
const hexFor = { api: "a", migrations: "b", ui: "c", site: "d" } as const;
const digestOf = (name: string) =>
  "sha256:" + hexFor[name as keyof typeof hexFor].repeat(64);
const digests = Object.fromEntries(
  imageNames.map((name) => [name, digestOf(name)]),
);
const placeholderOverlay = (suffix = "") =>
  "resources:\n  - ../../base\nimages:\n" +
  imageNames
    .map(
      (name) =>
        `  - name: ghcr.io/${repository}-${name}\n    newTag: latest\n`,
    )
    .join("") +
  "patches: []\n" +
  suffix;

describe("coordinated release", () => {
  test("requires matching workflows by file path, including unfiltered checks", () => {
    const workflows = [
      { path: "all.yml", on: { push: { branches: ["main"] } } },
      { path: "api.yml", on: { push: { paths: ["apps/api/**"] } } },
      { path: "ui.yml", on: { push: { paths: ["apps/ui/**"] } } },
      { path: "pr.yml", on: { pull_request: {} } },
      {
        path: ".github/workflows/production-release.yml",
        on: { push: { branches: ["main"] } },
      },
    ];
    expect(expectedWorkflows(workflows, ["apps/api/a.ts"])).toEqual([
      "all.yml",
      "api.yml",
    ]);
  });
  test("honours branch and ignore filters as GitHub does", () => {
    const workflows = [
      { path: "tags.yml", on: { push: { tags: ["v*"] } } },
      { path: "other.yml", on: { push: { branches: ["dev"] } } },
      {
        path: "ignored.yml",
        on: { push: { "paths-ignore": ["docs/**"] } },
      },
    ];
    expect(expectedWorkflows(workflows, ["docs/readme.md"])).toEqual([]);
    expect(expectedWorkflows(workflows, ["apps/api/a.ts"])).toEqual([
      "ignored.yml",
    ]);
  });
  test("never treats missing, running or failed checks as success", () => {
    expect(checkRuns(["a"], [])).toBe(false);
    expect(checkRuns(["a"], [{ path: "a", status: "queued" }])).toBe(false);
    expect(() =>
      checkRuns(
        ["a"],
        [{ path: "a", status: "completed", conclusion: "failure" }],
      ),
    ).toThrow();
    expect(() =>
      checkRuns(
        ["a"],
        [{ path: "a", status: "completed", conclusion: "cancelled" }],
      ),
    ).toThrow();
    expect(
      checkRuns(
        ["a"],
        [{ path: "a", status: "completed", conclusion: "success" }],
      ),
    ).toBe(true);
    expect(() => checkRuns([], [])).toThrow();
  });
  test("latest rerun takes precedence over older successful run", () => {
    expect(
      checkRuns(
        ["a"],
        [
          { path: "a", status: "queued" },
          { path: "a", status: "completed", conclusion: "success" },
        ],
      ),
    ).toBe(false);
  });
  test("pins every image or changes nothing; preserves unrelated configuration", () => {
    const text = placeholderOverlay();
    const result = pinImages(text, repository, digests);
    expect(result.match(/digest: sha256:/g)).toHaveLength(imageNames.length);
    expect(result).not.toContain("newTag");
    expect(result).toContain("patches: []");
    expect(result).toContain("resources:\n  - ../../base");
    expect(() =>
      pinImages(text, repository, { ...digests, api: "" }),
    ).toThrow();
    expect(() =>
      pinImages(text.replace("boringstack-ui", "other"), repository, digests),
    ).toThrow();
    expect(pinImages(result, repository, digests)).toBe(result);
  });
  test("the committed overlay pins exactly the images the release publishes", async () => {
    const overlay = YAML.parse(
      await Bun.file("infra/k3s/overlays/prod/kustomization.yaml").text(),
    ) as { images: Array<{ name: string; digest?: string }> };
    const names = overlay.images.map((image) => image.name).sort();
    expect(names).toEqual(
      imageNames
        .map((name) => `ghcr.io/${repository}-${name}`)
        .sort(),
    );
    // The committed overlay must stay in the shape the pin step rewrites.
    const pinned = pinImages(
      await Bun.file("infra/k3s/overlays/prod/kustomization.yaml").text(),
      repository,
      digests,
    );
    for (const name of imageNames) {
      expect(pinned).toContain(
        `  - name: ghcr.io/${repository}-${name}\n    digest: ${digests[name]}\n`,
      );
    }
  });
});

test("release configuration has one k8s publisher, requires activation, checks and a complete set", async () => {
  const workflow = YAML.parse(
    await Bun.file(".github/workflows/production-release.yml").text(),
  ) as {
    jobs: {
      release: {
        "runs-on": string;
        steps: Array<{
          run?: string;
          uses?: string;
          with?: { tags?: string; target?: string };
          env?: Record<string, string>;
        }>;
      };
    };
  };
  const release = workflow.jobs.release;
  expect(release["runs-on"]).toBe("ubuntu-24.04");
  const steps = release.steps;
  expect(steps[0].run).toContain('"$RELEASE_MODE" != coordinated');
  const gate = steps.findIndex((step) =>
    step.run?.includes("release.mjs gate"),
  );
  const builds = steps.filter((step) =>
    step.uses?.startsWith("docker/build-push-action"),
  );
  expect(builds).toHaveLength(imageNames.length);
  expect(gate).toBeGreaterThan(-1);
  expect(gate).toBeLessThan(steps.indexOf(builds[0]));
  expect(builds.every((step) => step.with?.tags?.includes(":candidate-"))).toBe(
    true,
  );
  expect(
    builds.map((step) => step.with?.tags?.match(/-(api|migrations|ui|site):/)?.[1]),
  ).toEqual(imageNames);
  const promotion = steps.at(-1);
  expect(Object.keys(promotion?.env ?? {}).sort()).toEqual([
    "API_DIGEST",
    "MIGRATIONS_DIGEST",
    "SITE_DIGEST",
    "UI_DIGEST",
  ]);
  expect(promotion?.run).toContain(
    'test "$(git rev-parse origin/main)" = "$GITHUB_SHA"',
  );
  expect(promotion?.run).not.toContain("--force");
  // Only the release workflow may write the production image pins.
  for (const file of [
    ".github/workflows/apps-api-release.yml",
    ".github/workflows/apps-ui-release.yml",
    ".github/workflows/apps-site-release.yml",
    ".github/workflows/infra-k3s-validate.yml",
  ]) {
    expect(await Bun.file(file).text()).not.toContain(
      "overlays/prod/kustomization.yaml",
    );
  }
});

test("no workflow still runs the Argo Image Updater for Kubernetes", async () => {
  const glob = new Bun.Glob(".github/workflows/*.yml");
  for await (const file of glob.scan(".")) {
    expect(await Bun.file(file).text()).not.toContain(
      "argocd-image-updater.argoproj.io/",
    );
  }
  expect(
    await Bun.file("infra/k3s/argocd/boringstack-prod.yaml").text(),
  ).not.toContain("argocd-image-updater.argoproj.io/");
});
