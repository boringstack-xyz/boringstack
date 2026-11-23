/*
 * The factory's knobs for this product. rename-project.sh rewrites
 * "boringstack" here like everywhere else; the rest is policy a product may
 * tune. Nothing in tools/factory hard-codes these values elsewhere.
 */
export const FACTORY_CONFIG = {
  /** Compose project prefix for per-slot stacks: `<project>-s<N>`. */
  project: "boringstack",
  /** Slots 1..maxSlots can run at once; each is a whole stack. */
  maxSlots: 8,
  /** Host ports for slot N are base + N (slot 0 is the developer's own `./setup.sh --up`). */
  portBases: {
    ui: 7400,
    api: 7500,
    postgres: 7600,
    valkey: 7700,
  },
  /** Branches agents never push to. */
  protectedBranches: ["main", "master"],
  /** Files agents never read or print (globs, repo-relative). */
  secretPaths: [
    "**/.env",
    "**/.env.*",
    "**/*.pem",
    "**/secrets/plain/**",
    ".agent-state/sandboxes/**",
  ],
  /** Files that look like secrets but are templates. */
  secretPathExceptions: ["**/.env.example", "**/*.env.example"],
  /** Self-refreshing fleet page. */
  fleetPort: 8500,
  /** Preview proxy: `<slot>.preview.localhost` by default. */
  previewHost: "preview.localhost",
  previewPort: 8600,
} as const;
