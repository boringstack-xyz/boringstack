#!/usr/bin/env node
/*
 * Assert that the agent-facing surface actually shipped, and is usable.
 *
 * This repo gates 21 bundle budgets, 83 repo-level lint rules and a coverage
 * ratchet. The files an agent reads first should not be the one unguarded
 * thing — especially since every defect this check covers was live in
 * production at some point:
 *
 *   - llms-small.txt was 412,756 bytes against llms-full.txt's 414,104
 *   - 46 `import ... from "..."` lines leaked into llms-full.txt
 *   - the install command appeared nowhere in llms.txt
 *
 * Run against dist/ after astro build. Exits non-zero with the fix on stderr.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const DOCS = resolve(import.meta.dirname, "..");
const DIST = join(DOCS, "dist");
const REPO_ROOT = resolve(DOCS, "..", "..");

const failures = [];
const notes = [];

const fail = (what, fix) => failures.push({ what, fix });
const read = (p) => readFileSync(join(DIST, p), "utf8");
const exists = (p) => existsSync(join(DIST, p));

/* ---------------------------------------------- the surface must exist */

const REQUIRED = [
  ["install.sh", "apps/docs/public/install.sh"],
  ["agents.md", "apps/docs/public/agents.md"],
  ["scaffold-manifest.json", "bun run generate:scaffold-manifest"],
  ["robots.txt", "apps/docs/public/robots.txt"],
  ["_redirects", "apps/docs/public/_redirects"],
  ["llms.txt", "the starlightLlmsTxt plugin in astro.config.mjs"],
  ["llms-small.txt", "the starlightLlmsTxt plugin in astro.config.mjs"],
  ["llms-full.txt", "the starlightLlmsTxt plugin in astro.config.mjs"],
];

for (const [file, source] of REQUIRED) {
  if (!exists(file)) fail(`dist/${file} is missing`, `check ${source}`);
}

if (failures.length > 0) {
  report();
}

/* ------------------------------------------------------- the installer */

const installer = read("install.sh");

if (!installer.startsWith("#!")) {
  fail("install.sh has no shebang", "the first line must be #!/usr/bin/env sh");
}
// curl | sh has no usable stdin, so a prompt is a hang, not a question.
for (const [pattern, label] of [
  [/^\s*read\s+/m, "a `read` call"],
  [/\/dev\/tty/, "a /dev/tty reference"],
]) {
  if (pattern.test(installer)) {
    fail(
      `install.sh contains ${label}, so it can block on input`,
      "curl | sh has no usable stdin; drive every decision from a flag or a probe",
    );
  }
}
if (!installer.includes("set -eu")) {
  fail("install.sh does not set -eu", "add `set -eu` so a failed step stops the run");
}

/* The installer hardcodes values that also live in the scaffold manifest.
 * Assert they agree rather than trusting a comment to keep them in step. */
const manifest = JSON.parse(
  readFileSync(join(REPO_ROOT, ".tsforge", "scaffold-manifest.json"), "utf8"),
);
const archetype = manifest.archetypes?.boringstack ?? {};

if (!installer.includes(`DEFAULT_REF="${manifest.defaultRef}"`)) {
  fail(
    `install.sh DEFAULT_REF does not match the manifest's defaultRef ("${manifest.defaultRef}")`,
    "update DEFAULT_REF in apps/docs/public/install.sh",
  );
}
for (const url of archetype.healthUrls ?? []) {
  if (!installer.includes(url)) {
    fail(
      `install.sh does not probe the manifest health URL ${url}`,
      "add it to the phase 5 health check in apps/docs/public/install.sh",
    );
  }
}
if (archetype.boot && !installer.includes("setup.sh --up")) {
  fail(
    `install.sh does not run the manifest boot command ("${archetype.boot}")`,
    "align phase 4 with archetypes.boringstack.boot",
  );
}

/* ------------------------------------------------------- the llms tiers */

const llms = read("llms.txt");
const small = read("llms-small.txt");
const full = read("llms-full.txt");

// An agent that reads only llms.txt must still know how to set the stack up.
if (!llms.includes("install.sh")) {
  fail(
    "llms.txt does not mention install.sh",
    "put the install command in the starlightLlmsTxt `description` or `details`",
  );
}
if (!llms.includes("agents.md")) {
  fail(
    "llms.txt does not point at /agents.md",
    "add it to `details` or `optionalLinks` in astro.config.mjs",
  );
}

// The bug this check exists for: a "small" tier that saves nothing.
const smallBytes = statSync(join(DIST, "llms-small.txt")).size;
const fullBytes = statSync(join(DIST, "llms-full.txt")).size;
const ratio = smallBytes / fullBytes;
/* Thresholds set with headroom over the real numbers at the time of writing
 * (67 KB, 16% of full) so ordinary doc growth does not trip them, but a
 * regression to a small tier that saves nothing does. */
const SMALL_MAX_RATIO = 0.35;
const SMALL_MAX_BYTES = 120_000;

if (ratio > SMALL_MAX_RATIO) {
  fail(
    `llms-small.txt is ${smallBytes} bytes, ${(ratio * 100).toFixed(1)}% of llms-full.txt (${fullBytes}) — the small tier is not smaller in any useful sense`,
    "widen the `exclude` list in the starlightLlmsTxt config; excluded pages stay in llms-full.txt",
  );
}
if (smallBytes > SMALL_MAX_BYTES) {
  fail(
    `llms-small.txt is ${smallBytes} bytes, over the ${SMALL_MAX_BYTES} ceiling`,
    "widen the `exclude` list in the starlightLlmsTxt config",
  );
}
notes.push(
  `llms-small.txt ${smallBytes} bytes (${(ratio * 100).toFixed(1)}% of full, ceiling ${SMALL_MAX_BYTES})`,
);

/* MDX residue. `rawContent: true` is load-bearing (index.mdx mounts a React
 * component the plugin cannot render), so sanitize-llms.mjs cleans up after
 * it. This asserts that pass actually ran. Code fences are exempt: a sample
 * may legitimately contain an import line. */
function prose(text) {
  return text
    .split("\n")
    .reduce(
      (acc, line) => {
        if (/^\s*(`{3,}|~{3,})/.test(line)) acc.inCode = !acc.inCode;
        else if (!acc.inCode) acc.lines.push(line);
        return acc;
      },
      { inCode: false, lines: [] },
    )
    .lines.join("\n");
}

for (const [name, text] of [
  ["llms.txt", llms],
  ["llms-small.txt", small],
  ["llms-full.txt", full],
]) {
  const body = prose(text);

  const imports = body.match(/^[ \t]*import\s+[^\n]*\s+from\s+["'][^"'\n]+["']/gm) ?? [];
  if (imports.length > 0) {
    fail(
      `${name} has ${imports.length} leaked MDX import line(s), e.g. ${JSON.stringify(imports[0].trim())}`,
      "run `bun run sanitize:llms` after the build, or extend scripts/sanitize-llms.mjs",
    );
  }

  const tags =
    body.match(
      /<\/?(?:Aside|DocCallout|LandingPage|Tabs|TabItem|CardGrid|LinkCard|Steps|FileTree|LintMetaCatalog|ScriptsCatalog|DataMatrix|HowToSchema|CostCalculator)\b/g,
    ) ?? [];
  if (tags.length > 0) {
    fail(
      `${name} has ${tags.length} leaked MDX component tag(s), e.g. ${JSON.stringify(tags[0])}`,
      "add the component to KNOWN_COMPONENTS in scripts/sanitize-llms.mjs",
    );
  }
}

// The 404 page is navigational dead weight in a documentation corpus.
if (small.includes("Page not found")) {
  fail(
    "llms-small.txt contains the 404 page",
    'keep "404" in the `exclude` list in astro.config.mjs',
  );
}

/* Ordering: an agent with a context budget reads the top and stops, so the
 * setup path has to be near the front rather than 40% deep. */
const quickstartAt = full.indexOf("# Quickstart");
if (quickstartAt === -1) {
  fail("llms-full.txt has no Quickstart section", "check the docs content collection");
} else {
  const depth = quickstartAt / full.length;
  if (depth > 0.2) {
    fail(
      `Quickstart sits ${(depth * 100).toFixed(0)}% into llms-full.txt`,
      "add it to `promote` in the starlightLlmsTxt config",
    );
  }
  notes.push(`Quickstart at ${(depth * 100).toFixed(1)}% of llms-full.txt`);
}

/* ------------------------------------------------------------- manifest */

const publishedManifest = read("scaffold-manifest.json");
const sourceManifest = readFileSync(
  join(REPO_ROOT, ".tsforge", "scaffold-manifest.json"),
  "utf8",
);
if (publishedManifest !== sourceManifest) {
  fail(
    "dist/scaffold-manifest.json differs from .tsforge/scaffold-manifest.json",
    "bun run generate:scaffold-manifest",
  );
}

/* -------------------------------------------------------------- agents.md */

const agents = read("agents.md");
for (const [needle, why] of [
  ["install.sh", "the setup command"],
  ["scaffold-manifest.json", "the machine-readable config surface"],
  ["localhost:7331", "the UI health check"],
  ["localhost:7330", "the API health check"],
  ["bun run check", "the oracle an agent must run"],
]) {
  if (!agents.includes(needle)) {
    fail(`agents.md is missing ${why} (${needle})`, "edit apps/docs/public/agents.md");
  }
}
/* Onboarding claims that were wrong twice: registration does not set
 * is_platform_admin (only apps/api/scripts/db/seed-superuser.ts does), and the
 * seed skips an email that already exists rather than promoting it, so
 * "register, then seed with that address" is a silent no-op. */
if (/first user becomes|becomes the superuser/i.test(agents)) {
  fail(
    "agents.md says the first signup becomes the superuser",
    "registration leaves is_platform_admin false; only seed-superuser.ts sets it",
  );
}
if (!/not.{0,20}registered/i.test(agents)) {
  fail(
    "agents.md does not warn that the superuser seed needs an unregistered email",
    "the seed skips an existing email instead of promoting it",
  );
}

// The instruction an agent structurally cannot follow.
if (/click\s+\*{0,2}Use this template/i.test(agents)) {
  fail(
    'agents.md tells the reader to click "Use this template"',
    "agents cannot click; document `gh repo create --template` instead",
  );
}

/* -------------------------------------------------- the homepage transcript */

/* An agent that fetched only the homepage read `gh repo create --template` in
 * the transcript and concluded it "will require you to authenticate with
 * GitHub in your browser". It does not: the installer falls back to
 * `git clone` on the public repo. agents.md said so, the homepage did not, and
 * the homepage is the page an agent hits first. Keep the fallback visible in
 * whichever surface names `gh`. */
const landing = readFileSync(
  join(DOCS, "src", "components", "landing", "landingContent.ts"),
  "utf8",
);
if (landing.includes("gh repo create") && !/git clone/.test(landing)) {
  fail(
    "the homepage names `gh repo create` without the `git clone` fallback",
    "an agent reading only the homepage concludes a browser login is required",
  );
}
if (!/auth(entication)? is optional/i.test(landing)) {
  fail(
    "the homepage does not say GitHub auth is optional",
    "add it to the agent tab caption in landingContent.ts",
  );
}

/* ------------------------------------------- the homepage survives flattening */

/*
 * An agent does not read the homepage, it reads a text conversion of it, and
 * the conversion has no CSS. Anything whose only separator is a Tailwind
 * `block` class, a flex `gap`, or whitespace the minifier is free to drop
 * arrives as one fused token.
 *
 * This shipped: the transcript gutter is a `<span>`, so the `ok` marker of one
 * line fused onto the end of the previous one and the install command came out
 * as `--project acmeok`. The footer entrypoint row fused into
 * `/agents.md/install.sh/scaffold-manifest.json...`.
 *
 * So flatten dist/index.html the way a converter does, honouring block-level
 * tags only, and assert the command survives intact.
 */
const flatten = (rawHtml) => {
  const body = rawHtml.includes("<body") ? rawHtml.slice(rawHtml.indexOf("<body")) : rawHtml;
  const BLOCK =
    "div|p|li|tr|h[1-6]|section|header|footer|nav|ul|ol|table|main|article|br|pre|blockquote|dd|dt";
  return body
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "")
    .replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`, "g"), "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
};

const homeText = flatten(read("index.html"));

/* Pulled from the source rather than hardcoded, so this check cannot pass
 * against a command the page no longer shows. */
const installCommandMatch = landing.match(
  /export const installCommand\s*=\s*\n?\s*"([^"]+)"/,
);
if (!installCommandMatch) {
  fail(
    "cannot find `export const installCommand` in landingContent.ts",
    "check-agent-surface parses it to verify the homepage renders it intact",
  );
}
const installCommand = installCommandMatch?.[1] ?? "";

// The command an agent copies must appear verbatim, with nothing fused to it.
if (installCommand && !homeText.includes(installCommand)) {
  fail(
    "the install command does not survive flattening dist/index.html to text",
    "a gutter or separator is CSS-only; use a block element so the text stream breaks",
  );
}
for (const fused of homeText.match(/\bacme\w+/g) ?? []) {
  fail(
    `flattened homepage contains "${fused}" where the project name should end`,
    "adjacent text fused onto the command; the separator before it is CSS-only",
  );
}
// Each agent entrypoint must read as its own path, not one run of them.
for (const path of ["/agents.md", "/install.sh", "/scaffold-manifest.json"]) {
  if (!new RegExp(`(^|[\\s(])${path.replace(/[.]/g, "\\.")}([\\s,.)]|$)`, "m").test(homeText)) {
    fail(
      `${path} does not stand alone in the flattened homepage`,
      "the link row needs block-level items; a flex gap is not a text separator",
    );
  }
}

/* ---------------------------------------------------------------- robots */

const robots = read("robots.txt");
for (const needle of ["install.sh", "agents.md", "scaffold-manifest.json"]) {
  if (!robots.includes(needle)) {
    fail(
      `robots.txt does not advertise ${needle}`,
      "add it to the agent-entrypoint block in apps/docs/public/robots.txt",
    );
  }
}

report();

function report() {
  for (const note of notes) console.log(`agent-surface: ${note}`);

  if (failures.length === 0) {
    console.log("agent-surface: ok");
    process.exit(0);
  }

  console.error(`\nagent-surface: ${failures.length} problem(s)\n`);
  for (const { what, fix } of failures) {
    console.error(`  ✗ ${what}`);
    console.error(`    fix: ${fix}\n`);
  }
  process.exit(1);
}
