#!/usr/bin/env tsx
import { buildRuleCatalog } from "./generate-rules-md";

process.stdout.write(`${JSON.stringify(buildRuleCatalog(), null, 2)}\n`);
