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
  /**
   * Files agents never read or print: env files (but not `*.example`),
   * private keys, the plain k3s secrets and the sandbox descriptors that hold
   * database passwords. Matched against words of a command or a path.
   */
  secretFilePattern:
    /(^|[\s/'"=])([\w.-]*\.env(?:\.(?!example(?![\w-]))[\w-]+)*|[\w.-]+\.pem|\.agent-state\/sandboxes\/[^\s'"]*)(?![\w.-])/u,
  /** Programs that reach real infrastructure; agents never run them. */
  forbiddenPrograms: ["kubectl", "helm", "argocd", "vault"],
  /** Subcommands of these programs that change real infrastructure. */
  forbiddenSubcommands: {
    tofu: ["apply", "destroy", "import"],
    terraform: ["apply", "destroy", "import"],
  },
  /**
   * Dev containers (`compose exec <name>`) where checks must not run: they
   * change what the running dev server serves and can OOM it. `factory
   * verify` runs checks in an owned sandbox instead.
   */
  serviceContainerPattern:
    /(^|[-_])(api-dev|ui-dev|site-dev|api|ui)([-_]\d+)?$/u,
  /** Self-refreshing fleet page. */
  fleetPort: 8500,
  /** Preview proxy: `<slot>.preview.localhost` by default. */
  previewHost: "preview.localhost",
  previewPort: 8600,
} as const;
