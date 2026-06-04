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

/*
 * Child exports run in sibling apps the docs build does not control — a
 * hang or failure there must surface with full context instead of
 * stalling the docs build or losing the error text. The timeout bounds
 * the wait; the catch re-throws with the child's captured stderr.
 */
const JSON_EXPORT_TIMEOUT_MS = 60_000;

function runJsonExport(cwd, command, args) {
  let stdout;

  try {
    stdout = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: JSON_EXPORT_TIMEOUT_MS,
    });
  } catch (error) {
    const stderr =
      error !== null && typeof error === "object" && "stderr" in error
        ? String(error.stderr ?? "").trim()
        : "";
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `[docs] ${command} ${args.join(" ")} failed in ${cwd}: ${reason}${
        stderr === "" ? "" : `\n--- child stderr ---\n${stderr}`
      }`
    );
  }

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
  // Remove every backtick, not just leading/trailing. Markdown cells like
  // `` `path/to/script.sh` (then X) `` carry an inline closing backtick that a
  // start/end-only strip would leave on the token after a whitespace split.
  return value.replace(/`/gu, "").trim();
}

function parseCommandName(cell, runner) {
  const stripped = stripBackticks(cell);
  const prefix = `${runner} `;

  if (stripped.startsWith(prefix)) {
    return stripped.slice(prefix.length).trim();
  }

  return stripped;
}

function firstSentence(paragraph) {
  const collapsed = paragraph.replace(/\s+/gu, " ").trim();

  if (collapsed === "") {
    return "";
  }

  const sentence = /^(.*?[.!?])(?:\s|$)/u.exec(collapsed)?.[1];

  if (sentence !== undefined) {
    return sentence;
  }

  // No sentence terminator: this is a colon/semicolon lead-in (e.g.
  // "Scaffolds a new API resource:") whose detail lives in an indented list
  // we deliberately dropped. Normalize the dangling mark to a period so the
  // catalog reads as a complete summary instead of a fragment.
  return collapsed.replace(/[:;,]+$/u, ".");
}

// Assemble the first prose paragraph, then keep its first sentence. Lines that
// the header indents (usage examples, bullet lists) end the paragraph — pulling
// them in is exactly what produced mid-sentence cuts on the public docs site.
function firstParagraphDescription(strippedLines) {
  const paragraph = [];

  for (const line of strippedLines) {
    const isBoundary =
      line.trim() === "" ||
      /^\s/u.test(line) ||
      line.startsWith("@") ||
      /^Usage:/iu.test(line.trim());

    if (isBoundary) {
      if (paragraph.length > 0) {
        break;
      }

      continue;
    }

    paragraph.push(line.trim());
  }

  return firstSentence(paragraph.join(" "));
}

function readScriptHeaderDescription(root, scriptPath) {
  const fullPath = join(root, "scripts", scriptPath);

  if (!existsSync(fullPath)) {
    return "";
  }

  const text = readFileSync(fullPath, "utf8");

  if (fullPath.endsWith(".sh")) {
    const lines = [];

    for (const line of text.split("\n")) {
      if (line.startsWith("#!")) {
        continue;
      }

      if (!line.startsWith("#")) {
        break;
      }

      lines.push(line.replace(/^#\s?/u, ""));
    }

    return firstParagraphDescription(lines);
  }

  const block = /\/\*\*([\s\S]*?)\*\//u.exec(text)?.[1];

  if (block === undefined) {
    return "";
  }

  const lines = block.split("\n").map((line) => line.replace(/^\s*\*\s?/u, ""));

  return firstParagraphDescription(lines);
}

// A catalog description that ends on a conjunction/article/preposition, or
// on a clause-joining mark, was cut mid-sentence by the extractor — the
// generated docs render it verbatim on the public site. This set is the
// guardrail: assertCatalogDescriptionsComplete refuses to emit such a
// description, so truncation can never silently ship again.
const DANGLING_TAIL = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "for", "with", "in",
  "on", "at", "by", "from", "as", "that", "is", "are", "via", "into",
  "when", "if", "so", "then", "than",
]);

export function isDescriptionComplete(description) {
  const trimmed = description.trim();

  if (trimmed === "") {
    return true;
  }

  if (/[,;:]$/u.test(trimmed)) {
    return false;
  }

  const lastWord = trimmed
    .split(/\s+/u)
    .at(-1)
    ?.replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase();

  return lastWord === undefined || !DANGLING_TAIL.has(lastWord);
}

function assertCatalogDescriptionsComplete(catalog) {
  const bad = [];

  for (const [template, data] of Object.entries(catalog)) {
    for (const command of data.commands) {
      if (!isDescriptionComplete(command.description)) {
        bad.push([`${template} ${command.command}`, command.description]);
      }
    }

    for (const entry of data.manual) {
      if (!isDescriptionComplete(entry.description)) {
        bad.push([`${template} ${entry.task}`, entry.description]);
      }
    }
  }

  if (bad.length > 0) {
    throw new Error(
      `[docs] ${bad.length} script description(s) cut mid-sentence:\n${bad
        .map(([label, description]) => `  ${label}: "…${description.slice(-48)}"`)
        .join("\n")}`
    );
  }
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

  const catalog = {
    ui: buildTemplateScriptsCatalog(uiRoot, "ui", "bun run"),
    api: buildTemplateScriptsCatalog(apiRoot, "api", "bun run"),
  };

  assertCatalogDescriptionsComplete(catalog);

  return catalog;
}

export function writeOrCheck(outputPath, payload, checkMode) {
  const next = `${JSON.stringify(payload, null, 2)}\n`;

  if (checkMode) {
    if (!existsSync(outputPath)) {
      console.error(`[docs] missing ${outputPath}, run generator`);
      process.exit(1);
    }

    const current = readFileSync(outputPath, "utf8");

    if (current !== next) {
      console.error(`[docs] ${outputPath} is out of date, run generator`);
      process.exit(1);
    }

    console.log(`[docs] ${outputPath} is up to date.`);

    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, next, "utf8");
  console.log(`[docs] wrote ${outputPath}`);
}
