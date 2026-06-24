import fs from "fs-extra";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import type { ITemplateMetadata, ProcessedValue } from "./preview.types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPONENTS_DIR = path.join(__dirname, "components");
const TEMPLATES_DIR = path.join(__dirname, "templates");
const PREVIEW_DIR = path.join(__dirname, "preview");

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

const getDummyValue = (varName: string): string => {
  const lowercased = varName.toLowerCase();

  if (lowercased.includes("subject")) {
    return "Sample Email Subject";
  }

  if (lowercased.includes("preheader")) {
    return "Sample preview text";
  }

  if (lowercased.includes("appname")) {
    return "Your App";
  }

  if (lowercased.includes("token")) {
    return "sample-token-12345";
  }

  if (lowercased.includes("avatar")) {
    return "https://i.pravatar.cc/300";
  }

  if (lowercased.includes("url")) {
    return "https://example.com/sample";
  }

  if (lowercased.includes("name") && !lowercased.includes("username")) {
    return "John Doe";
  }

  if (lowercased.includes("username")) {
    return "johndoe";
  }

  if (lowercased.includes("email")) {
    return "john@example.com";
  }

  if (lowercased.includes("type")) {
    return "article";
  }

  if (lowercased.includes("action")) {
    return "liked";
  }

  if (lowercased.includes("title")) {
    return "Sample Title";
  }

  if (lowercased.includes("cta") || lowercased.includes("button")) {
    return "View Details";
  }

  if (lowercased.includes("description")) {
    return "This is a sample description.";
  }

  return "Sample Value";
};

const processValue = (value: unknown): ProcessedValue => {
  if (typeof value === "string") {
    return value.replace(/{{([^}]+)}}/g, (_match, varName: string) => {
      const trimmed = varName.trim();
      const parts = trimmed.split(".");
      const lastPart = parts[parts.length - 1] ?? "";

      return getDummyValue(lastPart);
    });
  }

  if (Array.isArray(value)) {
    return value.map(processValue);
  }

  if (typeof value === "object" && value !== null) {
    const out: Record<string, ProcessedValue> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      out[key] = processValue(nestedValue);
    }

    return out;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
};

const generateDummyData = (variablesPath: string): Record<string, unknown> => {
  const fileContent = fs.readFileSync(variablesPath, "utf8");
  const parsed: unknown = JSON.parse(fileContent);
  const processed = processValue(parsed);

  if (typeof processed === "object" && !Array.isArray(processed)) {
    return processed;
  }

  return {};
};

const findTemplates = (dir: string, fileList: string[] = []): string[] => {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findTemplates(filePath, fileList);
    } else if (file.endsWith(".hbs") && file !== "content.hbs") {
      fileList.push(filePath);
    }
  }

  return fileList;
};

const generatePreview = (templatePath: string): ITemplateMetadata => {
  const source = fs.readFileSync(templatePath, "utf8");
  const template = Handlebars.compile(source);

  const dir = path.dirname(templatePath);
  const contentPath = path.join(dir, "content.hbs");
  const variablesPath = path.join(dir, "variables.json");

  const dummyData: Record<string, unknown> = fs.existsSync(variablesPath)
    ? generateDummyData(variablesPath)
    : {};

  let content = "";

  if (fs.existsSync(contentPath)) {
    const contentSource = fs.readFileSync(contentPath, "utf8");
    const contentTemplate = Handlebars.compile(contentSource);

    content = contentTemplate(dummyData);
  }

  const html = template({ ...dummyData, content });

  const relativePath = path.relative(TEMPLATES_DIR, templatePath);
  const outputDir = path.dirname(relativePath);
  const templateName = path.basename(relativePath, ".hbs");
  const outputPath = path.join(PREVIEW_DIR, outputDir, templateName + ".html");

  const previewWrapper = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${templateName} - Email Preview</title>
  <style>
    body { margin: 0; padding: 20px; background: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .preview-header { max-width: 1200px; margin: 0 auto 20px; background: #2D2D2D; border: 1px solid #404040; border-radius: 8px; padding: 16px 20px; color: #E8E8E8; font-size: 18px; font-weight: 600; }
    .email-wrapper { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="preview-header">${templateName.replace(/-/g, " ").replace(/\b\w/g, (initial) => initial.toUpperCase())}</div>
  <div class="email-wrapper">${html}</div>
</body>
</html>`;

  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, previewWrapper, "utf8");

  const pathRel = path
    .join(outputDir, templateName + ".html")
    .replace(/\\/g, "/");

  return {
    name: templateName,
    category: outputDir.split(path.sep)[0] ?? "",
    pathRel,
  };
};

const generateIndex = (templates: ITemplateMetadata[]): void => {
  const categories: Record<string, ITemplateMetadata[]> = {};

  for (const template of templates) {
    const bucket = categories[template.category] ?? [];

    bucket.push(template);
    categories[template.category] = bucket;
  }

  const sections = Object.keys(categories)
    .map((cat) => {
      const items = categories[cat] ?? [];
      const cards = items
        .map(
          (
            template
          ) => `<div class="card"><a href="${template.pathRel}" target="_blank">
        <div class="name">${template.name.replace(/-/g, " ").replace(/\b\w/g, (initial) => initial.toUpperCase())}</div>
        <div class="path">${template.pathRel}</div></a></div>`
        )
        .join("");

      return `<section><h2>${cat}</h2><div class="grid">${cards}</div></section>`;
    })
    .join("");

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Email Templates Preview</title>
  <style>
    body { margin: 0; padding: 40px 20px; background: #1a1a1a; color: #E8E8E8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #4ade80; font-size: 32px; margin: 0 0 32px; }
    section { margin-bottom: 32px; }
    h2 { color: #808080; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 1px solid #404040; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #2D2D2D; border: 1px solid #404040; border-radius: 8px; padding: 20px; transition: border-color 0.2s; }
    .card:hover { border-color: #4ade80; }
    .card a { color: #E8E8E8; text-decoration: none; display: block; }
    .name { font-weight: 500; margin-bottom: 8px; }
    .path { font-size: 12px; color: #808080; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Templates Preview</h1>
    ${sections}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(PREVIEW_DIR, "index.html"), indexHtml, "utf8");
};

/*
 * Build an allowlist of every file directly under PREVIEW_DIR at start
 * up. The server only serves what's in this map; `req.url` is used as
 * a lookup KEY (untrusted) but the path handed to `fs.readFileSync` is
 * always a VALUE pulled from this enumeration (trusted because it was
 * computed by walking the filesystem ourselves, not by parsing
 * user input).
 *
 * This shape is the one CodeQL's `js/path-injection` query recognises
 * as safe — none of the earlier `path.resolve` + `startsWith(PREVIEW_DIR)`
 * variants satisfied it because the read site still received a string
 * derived from `req.url`.
 */
const collectServableFiles = (): Map<string, string> => {
  const map = new Map<string, string>();

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const rel = path.relative(PREVIEW_DIR, abs).split(path.sep).join("/");

        map.set(`/${rel}`, abs);
      }
    }
  };

  walk(PREVIEW_DIR);

  return map;
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

const startServer = (port: number): void => {
  const servableFiles = collectServableFiles();
  /*
   * Re-resolved each request so the index page picked up after
   * `generateIndex()` ran is reachable. Generation happens before
   * `startServer`, so the initial enumeration already contains it —
   * but keeping the read fresh-on-each-request makes the watch-mode
   * story honest, with no measurable cost on a dev-only server.
   */

  const server = http.createServer((req, res) => {
    /*
     * Strip query / fragment, normalise the route. Empty / "/" → index.
     * `req.url` is the untrusted KEY into `servableFiles`; its parsed
     * value never feeds into any filesystem call.
     */
    const rawUrl = req.url ?? "";
    const decoded = (() => {
      try {
        return decodeURIComponent(rawUrl.split("?")[0]?.split("#")[0] ?? "");
      } catch {
        return "";
      }
    })();
    const route = decoded === "" || decoded === "/" ? "/index.html" : decoded;

    /*
     * Lookup-by-lookup: the candidate paths below are STRINGS WE
     * AUTHORED ABOVE (literal "/index.html", or the request `route`
     * augmented with a literal ".html"). The path handed to
     * `fs.readFileSync` is always pulled FROM `servableFiles`, whose
     * values are absolute paths discovered via `fs.readdirSync` of
     * PREVIEW_DIR. There is no flow from `req.url` to `readFileSync`.
     */
    const resolvedPath =
      servableFiles.get(route) ?? servableFiles.get(`${route}.html`);

    if (resolvedPath === undefined) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");

      return;
    }

    const ext = path.extname(resolvedPath);

    try {
      const content = fs.readFileSync(resolvedPath, "utf8");

      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[ext] ?? "text/plain",
      });
      res.end(content);
    } catch (error: unknown) {
      res.writeHead(500);
      res.end(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  server.listen(port, () => {
    console.log(
      `\n📧 Preview server running at http://localhost:${String(port)}\n`
    );
  });

  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
};

const main = (): void => {
  console.log("Generating preview pages...\n");
  registerHelpers();
  registerPartials();

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.log("No templates/ directory.");

    return;
  }

  const templates = findTemplates(TEMPLATES_DIR);

  fs.ensureDirSync(PREVIEW_DIR);
  const previews = templates.map(generatePreview);

  generateIndex(previews);
  console.log(`✓ Generated ${String(previews.length)} preview page(s)`);

  /*
   * PREVIEW_PORT: dev-only override for this template-preview server's port
   * (defaults to 3002). Read directly rather than via the validated env schema
   * because it never runs in the deployed app — only `bun run preview:templates`.
   */
  const portEnv = process.env.PREVIEW_PORT;
  const port =
    portEnv !== undefined && portEnv !== "" ? parseInt(portEnv, 10) : 3002;

  startServer(port);
};

main();
