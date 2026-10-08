import { readdir, readFile, writeFile } from "node:fs/promises";
import { Glob, YAML } from "bun";

// Every image the production overlay pins. Keep in sync with the `images:`
// block in infra/k3s/overlays/prod/kustomization.yaml (the tests enforce it).
const images = ["api", "migrations", "ui", "site"];
const releasePath = ".github/workflows/production-release.yml";
const overlayPath = "infra/k3s/overlays/prod/kustomization.yaml";

function matches(patterns, path) {
  let included = false;
  for (const pattern of patterns) {
    const negative = pattern.startsWith("!");
    if (new Glob(negative ? pattern.slice(1) : pattern).match(path))
      included = !negative;
  }
  return included;
}

// Which push workflows must succeed for this commit. A workflow is required
// when a main push would run it: branch filter, path filter and ignore lists
// all apply, exactly as GitHub evaluates them.
export function expectedWorkflows(workflows, changed) {
  return workflows
    .filter((workflow) => {
      if (
        workflow.path === releasePath ||
        !Object.hasOwn(workflow.on ?? {}, "push")
      )
        return false;
      const push = workflow.on.push ?? {};
      if (push.tags && !push.branches) return false;
      if (push.branches && !matches(push.branches, "main")) return false;
      if (push["branches-ignore"] && matches(push["branches-ignore"], "main"))
        return false;
      if (push.paths && !changed.some((path) => matches(push.paths, path)))
        return false;
      if (
        push["paths-ignore"] &&
        changed.every((path) => matches(push["paths-ignore"], path))
      )
        return false;
      return true;
    })
    .map((workflow) => workflow.path);
}

// GitHub returns newest runs first. A rerun must never inherit an old success.
export function checkRuns(expected, runs) {
  if (!expected.length)
    throw new Error("No required workflows discovered; refusing release");
  let ready = true;
  for (const path of expected) {
    const run = runs.find((item) => item.path === path);
    if (!run || run.status !== "completed") {
      ready = false;
    } else if (run.conclusion !== "success") {
      throw new Error(`Release blocked by ${path}: ${run.conclusion}`);
    }
  }
  return ready;
}

export function pinImages(text, repository, digests) {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(repository))
    throw new Error("Invalid repository");
  for (const image of images) {
    if (!/^sha256:[a-f0-9]{64}$/.test(digests[image] ?? ""))
      throw new Error(`Missing/invalid ${image} digest`);
    const escaped = `ghcr.io/${repository}-${image}`.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const pattern = new RegExp(
      `(  - name: ${escaped}\\n)((?:    [^\\n]*\\n)*)`,
      "g",
    );
    let count = 0;
    text = text.replace(pattern, (whole, name) => {
      count++;
      return `${name}    digest: ${digests[image]}\n`;
    });
    if (count !== 1)
      throw new Error(`Expected exactly one production ${image} image`);
  }
  return text;
}

async function command(args) {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "inherit" });
  const output = await new Response(child.stdout).text();
  if ((await child.exited) !== 0)
    throw new Error(`Command failed: ${args[0]} ${args[1]}`);
  return output.trim();
}

async function gate() {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const sha = process.env.GITHUB_SHA;
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !/^[a-f0-9]{40}$/.test(event.before ?? "")
  )
    throw new Error("Release requires a main push event");
  const changed = (
    await command(["git", "diff", "--name-only", event.before, sha])
  ).split("\n");
  const workflows = [];
  for (const file of await readdir(".github/workflows")) {
    if (!/\.ya?ml$/.test(file)) continue;
    const path = `.github/workflows/${file}`;
    workflows.push({ ...YAML.parse(await readFile(path, "utf8")), path });
  }
  const expected = expectedWorkflows(workflows, changed);
  console.log("Waiting for successful checks at", sha, expected);
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline) {
    const pages = JSON.parse(
      await command([
        "gh",
        "api",
        "--paginate",
        "--slurp",
        `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${sha}&event=push&per_page=100`,
      ]),
    );
    const runs = pages.flatMap((page) => page.workflow_runs);
    if (checkRuns(expected, runs)) return;
    await Bun.sleep(15_000);
  }
  throw new Error(
    "CI did not complete within 45 minutes; no production images changed",
  );
}

async function promote() {
  const digests = Object.fromEntries(
    images.map((image) => [image, process.env[`${image.toUpperCase()}_DIGEST`]]),
  );
  const text = await readFile(overlayPath, "utf8");
  // Validate the full set before touching disk.
  await writeFile(
    overlayPath,
    pinImages(text, process.env.GITHUB_REPOSITORY, digests),
  );
}

if (import.meta.main) {
  const action = process.argv[2];
  if (action === "gate") await gate();
  else if (action === "pin") await promote();
  else throw new Error("Expected gate or pin");
}
