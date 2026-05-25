import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveTemplateRoot(envKey, siblingName) {
  const fromEnv = process.env[envKey];

  if (fromEnv !== undefined && fromEnv !== "") {
    return resolve(fromEnv);
  }

  return resolve(DOCS_ROOT, "..", siblingName);
}

function runJsonExport(cwd, command, args) {
  const stdout = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return JSON.parse(stdout);
}

export function buildLintMetaCatalog() {
  const uiRoot = resolveTemplateRoot("BORINGSTACK_UI_DIR", "ui");
  const apiRoot = resolveTemplateRoot("BORINGSTACK_API_DIR", "api");

  if (!existsSync(uiRoot)) {
    throw new Error(`apps/ui not found at ${uiRoot}`);
  }

  if (!existsSync(apiRoot)) {
    throw new Error(`apps/api not found at ${apiRoot}`);
  }

  for (const [label, root, relPath] of [
    ["ui", uiRoot, "scripts/lint-meta/export-catalog.ts"],
    ["api", apiRoot, "scripts/lint-meta/export-catalog.ts"],
  ]) {
    if (!existsSync(join(root, relPath))) {
      throw new Error(
        `${label} is missing ${relPath}. Ensure apps/ui and apps/api export scripts exist (monorepo checkout).`
      );
    }
  }

  return {
    ui: runJsonExport(uiRoot, "bun", [
      "run",
      "scripts/lint-meta/export-catalog.ts",
    ]),
    api: runJsonExport(apiRoot, "bun", [
      "run",
      "scripts/lint-meta/export-catalog.ts",
    ]),
  };
}

function parseMarkdownTableSection(text, heading) {
  const sectionRegex = new RegExp(
    `## ${heading}[\\s\\S]*?\\n\\|[^\\n]+\\|\\n\\|[-| ]+\\|\\n([\\s\\S]*?)(?:\\n## |\\n$|$)`,
    "u"
  );
  const match = sectionRegex.exec(text);

  if (match?.[1] === undefined) {
    return [];
  }

  const rows = [];

  for (const line of match[1].trim().split("\n")) {
    if (!line.startsWith("|")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 2) {
      continue;
    }

    rows.push(cells);
  }

  return rows;
}

function stripBackticks(value) {
  return value.replace(/^`+|`+$/gu, "").trim();
}

function parseCommandName(cell, runner) {
  const stripped = stripBackticks(cell);
  const prefix = `${runner} `;

  if (stripped.startsWith(prefix)) {
    return stripped.slice(prefix.length).trim();
  }

  return stripped;
}

function readScriptHeaderDescription(root, scriptPath) {
  const fullPath = join(root, "scripts", scriptPath);

  if (!existsSync(fullPath)) {
    return "";
  }

  const text = readFileSync(fullPath, "utf8");

  if (fullPath.endsWith(".sh")) {
    const description = text
      .split("\n")
      .slice(0, 12)
      .filter((line) => line.startsWith("#") && !line.startsWith("#!"))
      .map((line) => line.replace(/^#\s?/u, "").trim())
      .find((line) => line.length > 0);

    return description ?? "";
  }

  const block = /\/\*\*([\s\S]*?)\*\//u.exec(text)?.[1];

  if (block === undefined) {
    return "";
  }

  const paragraph = block
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("@"))
    .find((line) => !line.startsWith("Usage:"));

  return paragraph ?? "";
}

function readPrePushStages(root) {
  const prePushPath = join(root, "scripts", "ci", "pre-push.sh");

  if (!existsSync(prePushPath)) {
    return [];
  }

  const text = readFileSync(prePushPath, "utf8");
  const stages = [];

  for (const match of text.matchAll(/^step "([^"]+)"/gmu)) {
    const label = match[1];

    if (label !== undefined) {
      stages.push(label);
    }
  }

  return stages;
}

function buildTemplateScriptsCatalog(root, template, runner) {
  const readmePath = join(root, "scripts", "README.md");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const readme = readFileSync(readmePath, "utf8");

  const folders = parseMarkdownTableSection(readme, "Folders").map(
    ([folder, purpose]) => ({
      folder: stripBackticks(folder),
      purpose,
    })
  );

  const commandSections = ["Command map", "Maintainer"].flatMap((heading) =>
    parseMarkdownTableSection(readme, heading).map(([commandCell, scriptCell]) => {
      const scriptPath = stripBackticks(scriptCell).split(/\s/u)[0] ?? "";
      const description = readScriptHeaderDescription(root, scriptPath);

      return {
        command: parseCommandName(commandCell, runner),
        script: scriptPath,
        description,
      };
    })
  );

  const manual = parseMarkdownTableSection(readme, "Manual / operator").map(
    ([task, scriptCell]) => ({
      task,
      script: stripBackticks(scriptCell),
      description: readScriptHeaderDescription(
        root,
        stripBackticks(scriptCell)
      ),
    })
  );

  const documented = new Map(
    commandSections.map((entry) => [entry.command, entry])
  );

  const commands = Object.entries(pkg.scripts ?? {})
    .filter(([, value]) => /(?:^|[&|;]\s*|\s)(?:\.\/)?scripts\//u.test(value))
    .map(([command, value]) => {
      const scriptMatch =
        /(?:^|[&|;]\s*|\s)((?:\.\/)?scripts\/[^\s"']+)/u.exec(value)?.[1] ??
        "";
      const normalizedScript = scriptMatch.replace(/^\.\//u, "");
      const fromReadme = documented.get(command);

      return {
        command,
        script: fromReadme?.script ?? normalizedScript,
        description:
          fromReadme?.description ??
          readScriptHeaderDescription(root, normalizedScript),
        invocation: value,
      };
    });

  return {
    template,
    runner,
    folders,
    commands,
    manual,
    prePushStages: readPrePushStages(root),
  };
}

export function buildScriptsCatalog() {
  const uiRoot = resolveTemplateRoot("BORINGSTACK_UI_DIR", "ui");
  const apiRoot = resolveTemplateRoot("BORINGSTACK_API_DIR", "api");

  return {
    ui: buildTemplateScriptsCatalog(uiRoot, "ui", "bun run"),
    api: buildTemplateScriptsCatalog(apiRoot, "api", "bun run"),
  };
}

export function writeOrCheck(outputPath, payload, checkMode) {
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    if (!existsSync(outputPath)) {
      console.error(`[docs] missing ${outputPath} — run generator`);
      process.exit(1);
    }

    const current = readFileSync(outputPath, "utf8");

    if (current !== next) {
      console.error(`[docs] ${outputPath} is out of date — run generator`);
      process.exit(1);
    }

    console.log(`[docs] ${outputPath} is up to date.`);

    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, next, "utf8");
  console.log(`[docs] wrote ${outputPath}`);
}
