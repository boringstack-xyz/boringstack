// Renders nginx/nginx.conf.template into .build/nginx.conf with the CSP derived
// from the same validated configuration as the pages. Run after `astro build`
// in the image build stage; the container never renders anything at start.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildCsp, resolveSiteConfig } from "../src/lib/config-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env };
const config = resolveSiteConfig(env);
const csp = buildCsp(config);
if (csp.includes('"')) throw new Error("CSP must not contain double quotes");

const template = await readFile(
  join(root, "nginx/nginx.conf.template"),
  "utf8",
);
if (!template.includes("__CSP__"))
  throw new Error("nginx template is missing __CSP__");
const output = join(root, ".build/nginx.conf");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, template.replaceAll("__CSP__", csp));
console.log(`Rendered ${output}`);
