import { readdir, readFile, writeFile } from "node:fs/promises";
import { Glob, YAML } from "bun";

// Every image the production overlay pins. Keep in sync with the `images:`
// block in infra/k3s/overlays/prod/kustomization.yaml (the tests enforce it).
const images = ["api", "migrations", "ui", "site"];
const releasePath = ".github/workflows/production-release.yml";
export const mergeGatePath = ".github/workflows/merge-gate.yml";
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

// `event` is the trigger whose workflows must run: "push" for the release
// gate on main, "pull_request" for the merge gate on a PR into main. A
// workflow is expected when that trigger would run it: branch filter, path
// filter and ignore lists all apply, exactly as GitHub evaluates them.
export function expectedWorkflows(workflows, changed, event = "push") {
  return workflows
    .filter((workflow) => {
      if (
        workflow.path === releasePath ||
        workflow.path === mergeGatePath ||
        !Object.hasOwn(workflow.on ?? {}, event)
      )
        return false;
      const trigger = workflow.on[event] ?? {};
      if (trigger.tags && !trigger.branches) return false;
      if (trigger.branches && !matches(trigger.branches, "main")) return false;
      if (
        trigger["branches-ignore"] &&
        matches(trigger["branches-ignore"], "main")
      )
        return false;
      if (
        trigger.paths &&
        !changed.some((path) => matches(trigger.paths, path))
      )
        return false;
      if (
        trigger["paths-ignore"] &&
        changed.every((path) => matches(trigger["paths-ignore"], path))
      )
        return false;
      return true;
    })
    .map((workflow) => workflow.path);
}

// GitHub returns newest runs first. A rerun must never inherit an old success.
// "success" passes, and so does "skipped": a run whose jobs all skipped
// themselves by their own `if:` does not apply to this change.
export function checkRuns(expected, runs, label = "Release") {
  if (!expected.length)
    throw new Error(
      "No required workflows discovered; refusing " + label.toLowerCase(),
    );
  let ready = true;
  for (const path of expected) {
    const run = runs.find((item) => item.path === path);
    if (!run || run.status !== "completed") {
      ready = false;
    } else if (run.conclusion !== "success" && run.conclusion !== "skipped") {
      throw new Error(`${label} blocked by ${path}: ${run.conclusion}`);
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

async function command(args, { timeoutMs } = {}) {
  const child = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "inherit",
    ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
  });
  const output = await new Response(child.stdout).text();
  if ((await child.exited) !== 0)
    throw new Error(`Command failed: ${args[0]} ${args[1]}`);
  return output.trim();
}

async function loadWorkflows(dir = ".github/workflows") {
  const workflows = [];
  for (const file of await readdir(dir)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const path = `.github/workflows/${file}`;
    workflows.push({
      ...YAML.parse(await readFile(`${dir}/${file}`, "utf8")),
      path,
    });
  }
  return workflows;
}

// Polls until every expected workflow has a completed run for `sha` and
// `event`, or throws on the first non-success conclusion.
async function waitForChecks({
  sha,
  event,
  expected,
  label,
  timeoutMessage,
  minutes = 45,
}) {
  console.log(`Waiting for ${label} checks at`, sha, expected);
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    // A stalled or failing API call (GitHub returned 502s for an hour on
    // 2026-10-24 and one call hung a gate for 68 minutes) is retried on the
    // next poll rather than hanging or failing the gate; the deadline still
    // bounds the wait.
    let pages;
    try {
      pages = JSON.parse(
        await command(
          [
            "gh",
            "api",
            "--paginate",
            "--slurp",
            `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${sha}&event=${event}&per_page=100`,
          ],
          { timeoutMs: 60_000 },
        ),
      );
    } catch (error) {
      console.warn(
        `Polling ${label} checks failed, retrying: ${error.message}`,
      );
      await Bun.sleep(15_000);
      continue;
    }
    const runs = pages.flatMap((page) => page.workflow_runs);
    if (checkRuns(expected, runs, label)) return;
    await Bun.sleep(15_000);
  }
  throw new Error(timeoutMessage);
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
  const expected = expectedWorkflows(await loadWorkflows(), changed);
  try {
    await waitForChecks({
      sha,
      event: "push",
      expected,
      label: "Release",
      timeoutMessage:
        "CI did not complete within 45 minutes; no production images changed",
    });
  } catch (error) {
    // A newer push to main cancels this commit's in-flight checks, and its
    // own release ships this commit too. That is a skip, not a failure.
    if (await superseded(sha)) {
      console.log(
        `Superseded by a newer main commit; skipping (${error.message})`,
      );
      await markSuperseded();
      return;
    }
    throw error;
  }
  if (await superseded(sha)) await markSuperseded();
}

async function superseded(sha) {
  await command(["git", "fetch", "--quiet", "origin", "main"]);
  return (await command(["git", "rev-parse", "origin/main"])) !== sha;
}

async function markSuperseded() {
  if (process.env.GITHUB_OUTPUT)
    await writeFile(process.env.GITHUB_OUTPUT, "superseded=true\n", {
      flag: "a",
    });
}

// Changed files for a PR, including the old name of a renamed file.
async function listPullFiles(number) {
  const pages = JSON.parse(
    await command(
      [
        "gh",
        "api",
        "--paginate",
        "--slurp",
        `repos/${process.env.GITHUB_REPOSITORY}/pulls/${number}/files?per_page=100`,
      ],
      { timeoutMs: 60_000 },
    ),
  );
  return pages
    .flat()
    .flatMap((file) =>
      file.previous_filename
        ? [file.filename, file.previous_filename]
        : [file.filename],
    );
}

// Required check `merge-gate` on every PR into main. Waits for every workflow
// the PR's diff triggers, at its head SHA, so the merge is blocked by the same
// set the release gate would wait for on main.
async function prGate() {
  const payload = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const pr = payload.pull_request;
  const sha = pr?.head?.sha;
  if (!/^[a-f0-9]{40}$/.test(sha ?? ""))
    throw new Error("Merge gate requires a pull_request event");
  const changed = await listPullFiles(pr.number);
  // The PR's own workflow files decide what is expected (a new workflow must
  // be waited for). GitHub picks the runs from the PR merged into the current
  // base, so the gate code always runs from the base branch.
  const expected = expectedWorkflows(
    await loadWorkflows(process.env.PR_WORKFLOWS_DIR ?? ".github/workflows"),
    changed,
    "pull_request",
  );
  await waitForChecks({
    sha,
    event: "pull_request",
    expected,
    label: "Merge",
    // The gate runs on a light pool, so waiting is cheap; a PR that touches
    // apps/api queues many jobs behind other PRs under load.
    minutes: 150,
    timeoutMessage:
      "Checks did not complete within 150 minutes; the merge gate failed",
  });
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
  else if (action === "pr-gate") await prGate();
  else if (action === "pin") await promote();
  else throw new Error("Expected gate, pr-gate or pin");
}
