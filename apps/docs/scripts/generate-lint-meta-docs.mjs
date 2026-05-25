#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLintMetaCatalog,
  writeOrCheck,
} from "./docs-catalog-lib.mjs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const checkMode = process.argv.includes("--check");

writeOrCheck(
  join(DATA_DIR, "lint-meta-catalog.json"),
  buildLintMetaCatalog(),
  checkMode
);
