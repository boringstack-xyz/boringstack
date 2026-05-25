import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Handlebars.precompile() returns a JS source string at runtime, but its
 * types declare `TemplateSpecification` (an object). Validate at runtime so
 * we can hand it to JSON.stringify safely.
 */
const precompileToString = (input: string): string => {
  const result: unknown = Handlebars.precompile(input);

  if (typeof result !== "string") {
    throw new Error("Handlebars.precompile did not return a string");
  }

  return result;
};

const COMPONENTS_DIR = path.join(__dirname, "components");
const TEMPLATES_DIR = path.join(__dirname, "templates");
const DIST_DIR = path.join(__dirname, "dist");

const registerHelpers = (): void => {
  Handlebars.registerHelper("concat", (...args: unknown[]) => {
    args.pop();

    return args.join("");
  });

  Handlebars.registerHelper(
    "eq",
    (left: unknown, right: unknown) => left === right
  );
};

const registerPartials = (): void => {
  if (!fs.existsSync(COMPONENTS_DIR)) {
    return;
  }

  const partialFiles = fs.readdirSync(COMPONENTS_DIR);

  for (const file of partialFiles) {
    if (file.endsWith(".hbs")) {
      const partialName = path.basename(file, ".hbs");
      const partialContent = fs.readFileSync(
        path.join(COMPONENTS_DIR, file),
        "utf8"
      );

      Handlebars.registerPartial(partialName, partialContent);
    }
  }
};

const findTemplates = (dir: string, fileList: string[] = []): string[] => {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findTemplates(filePath, fileList);
    } else if (
      file.endsWith(".hbs") &&
      !file.startsWith("_") &&
      file !== "content.hbs" &&
      dir.includes("templates")
    ) {
      fileList.push(filePath);
    }
  }

  return fileList;
};

const precompilePartials = (): Record<string, string> => {
  const partials: Record<string, string> = {};

  if (!fs.existsSync(COMPONENTS_DIR)) {
    return partials;
  }

  const partialFiles = fs.readdirSync(COMPONENTS_DIR);

  for (const file of partialFiles) {
    if (file.endsWith(".hbs")) {
      const partialName = path.basename(file, ".hbs");
      const partialContent = fs.readFileSync(
        path.join(COMPONENTS_DIR, file),
        "utf8"
      );

      partials[partialName] = precompileToString(partialContent);
    }
  }

  return partials;
};

const buildTemplate = (templatePath: string): void => {
  const source = fs.readFileSync(templatePath, "utf8");
  const baseTemplate = precompileToString(source);

  const relativePath = path.relative(TEMPLATES_DIR, templatePath);
  const outputDir = path.dirname(relativePath);
  const templateName = path.basename(relativePath, ".hbs");
  const outputPath = path.join(DIST_DIR, outputDir, templateName + ".json");

  fs.ensureDirSync(path.dirname(outputPath));

  const contentPath = path.join(path.dirname(templatePath), "content.hbs");
  let contentTemplate: string | null = null;

  if (fs.existsSync(contentPath)) {
    const contentSource = fs.readFileSync(contentPath, "utf8");

    contentTemplate = precompileToString(contentSource);
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ baseTemplate, contentTemplate }, null, 2),
    "utf8"
  );
  console.log(`✓ Built: ${path.relative(__dirname, outputPath)}`);
};

const buildPartialsManifest = (): void => {
  const partials = precompilePartials();

  fs.ensureDirSync(DIST_DIR);
  const manifestPath = path.join(DIST_DIR, "partials.json");

  fs.writeFileSync(manifestPath, JSON.stringify(partials, null, 2), "utf8");
  console.log(
    `✓ Built partials manifest: ${path.relative(__dirname, manifestPath)}`
  );
};

const buildAll = (): void => {
  console.log("Building email templates...\n");
  registerHelpers();
  registerPartials();
  buildPartialsManifest();

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.log("No templates/ directory; nothing to build.");

    return;
  }

  const templates = findTemplates(TEMPLATES_DIR);

  if (templates.length === 0) {
    console.log("No .hbs template files found.");

    return;
  }

  for (const template of templates) {
    buildTemplate(template);
  }

  console.log(`\n✓ Built ${String(templates.length)} template(s)`);
};

const watch = async (): Promise<void> => {
  /*
   * Dynamic import keeps chokidar out of the prod install path: the one-shot
   * `build:templates` script only needs handlebars + fs, and prod images
   * run `bun install --production` (devDeps excluded).
   */
  const { default: chokidar } = await import("chokidar");

  console.log("Watching for changes...\n");
  registerPartials();

  const watcher = chokidar.watch([
    path.join(TEMPLATES_DIR, "**/*.hbs"),
    path.join(COMPONENTS_DIR, "**/*.hbs"),
  ]);

  watcher.on("change", (filePath: string) => {
    console.log(`\nChange detected: ${filePath}`);

    if (filePath.includes("components")) {
      registerHelpers();
      registerPartials();
      buildAll();
    } else {
      buildTemplate(filePath);
    }
  });

  watcher.on("ready", () => {
    buildAll();
    console.log("\nReady. Watching for changes...");
  });
};

const args = process.argv.slice(2);

if (args.includes("--watch")) {
  void watch();
} else {
  buildAll();
}
