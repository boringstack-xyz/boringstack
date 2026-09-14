#!/usr/bin/env tsx
/**
 * Scaffold a new feature folder.
 *
 *   bun run new:feature Posts [--i18n-namespace]
 *
 * Creates src/features/posts/ with all dot-suffix files filled in
 * (constants, schemas, types, queries, store, utils) and a starter
 * components/<Feature>Page/ component.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SRC = resolve(process.cwd(), "src", "features");

function bail(message: string): never {
  console.error(`[new:feature] ${message}`);
  process.exit(1);
}

const arg = process.argv[2];

if (typeof arg !== "string" || arg.length === 0) {
  bail("Usage: bun run new:feature <Name> [--i18n-namespace]");
}

if (!/^[A-Z][A-Za-z0-9]+$/.test(arg)) {
  bail(`Feature name must be PascalCase (got '${arg}')`);
}

const options = process.argv.slice(3);
const namespaceEnabled = options.includes("--i18n-namespace");

if (options.some((option) => option !== "--i18n-namespace")) {
  bail("Unknown option. Supported: --i18n-namespace");
}

const Name = arg;
const lower = Name.toLowerCase();
const featureDir = join(SRC, lower);

if (existsSync(featureDir)) {
  bail(`Feature already exists: ${featureDir}`);
}

const localesDir = resolve(process.cwd(), "src/lib/i18n/locales");
const namespacePaths = namespaceEnabled
  ? readdirSync(localesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(localesDir, entry.name, `${lower}.json`))
  : [];

if (namespacePaths.some((path) => existsSync(path))) {
  bail(`Locale namespace already exists: ${lower}`);
}

const budgetPath = resolve(process.cwd(), ".size-limit.json");
const budgets: unknown = namespaceEnabled
  ? JSON.parse(readFileSync(budgetPath, "utf8"))
  : [];

if (!Array.isArray(budgets)) {
  bail("Expected .size-limit.json to contain an array");
}

mkdirSync(featureDir, { recursive: true });

const dotFiles: Record<string, string> = {
  [`${Name}.constants.ts`]: `export const ${Name.toUpperCase()}_QUERY_KEYS = {
  list: ["${lower}", "list"] as const
};
`,
  [`${Name}.schemas.ts`]: `import { z } from "zod";

export const ${lower}ItemSchema = z.object({
  id: z.uuid(),
  createdAt: z.string()
});
`,
  [`${Name}.types.ts`]: `import type { z } from "zod";
import type { ${lower}ItemSchema } from "./${Name}.schemas";

export type I${Name}Item = z.infer<typeof ${lower}ItemSchema>;
`,
  [`${Name}.utils.ts`]: `import type { I${Name}Item } from "./${Name}.types";

export function sort${Name}ByCreated(items: readonly I${Name}Item[]): I${Name}Item[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
`,
  [`${Name}.queries.ts`]: `import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ${Name.toUpperCase()}_QUERY_KEYS } from "./${Name}.constants";
import type { I${Name}Item } from "./${Name}.types";

/**
 * Replace the queryFn stub with a typed call. Errors THROW via the client
 * middleware — do NOT check \`response.error\` (dead \`no-unnecessary-condition\`).
 * Read \`data\`:
 *
 *   import { apiClient } from "@/lib/api/client";
 *   queryFn: async (): Promise<I${Name}Item[]> => {
 *     const { data } = await apiClient.GET("/api/${lower}");
 *     return data ?? [];
 *   }
 *
 * Run \`bun run generate:api\` after the endpoint is added to the OpenAPI spec.
 */
export function use${Name}(): UseQueryResult<I${Name}Item[]> {
  return useQuery({
    queryKey: ${Name.toUpperCase()}_QUERY_KEYS.list,
    queryFn: async (): Promise<I${Name}Item[]> => Promise.resolve([])
  });
}
`,
  [`${Name}.mutations.ts`]: `import {
  useMutation,
  useQueryClient,
  type UseMutationResult
} from "@tanstack/react-query";
import { ${Name.toUpperCase()}_QUERY_KEYS } from "./${Name}.constants";
import type { I${Name}Item } from "./${Name}.types";

/**
 * Replace the mutationFn stub with a typed call. Errors THROW via the client
 * middleware — do NOT check \`response.error\` (it is typed \`undefined\`, so any
 * such guard is a dead \`no-unnecessary-condition\` lint error). Read \`data\`:
 *
 *   import { apiClient } from "@/lib/api/client";
 *   mutationFn: async (input: I${Name}Item): Promise<I${Name}Item> => {
 *     const { data } = await apiClient.POST("/api/${lower}", { body: input });
 *     return data;
 *   }
 *
 * Run \`bun run generate:api\` after the endpoint is added to the OpenAPI spec.
 */
export function useCreate${Name}(): UseMutationResult<
  I${Name}Item,
  unknown,
  I${Name}Item
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: I${Name}Item): Promise<I${Name}Item> =>
      Promise.resolve(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ${Name.toUpperCase()}_QUERY_KEYS.list
      });
    }
  });
}
`,
  [`${Name}.store.ts`]: `import { create } from "zustand";

interface I${Name}State {
  readonly selectedId: string | null;
  setSelected(id: string | null): void;
}

export const use${Name}Store = create<I${Name}State>((set) => ({
  selectedId: null,
  setSelected: (id) => {
    set({ selectedId: id });
  }
}));
`
};

for (const [file, content] of Object.entries(dotFiles)) {
  writeFileSync(join(featureDir, file), content, "utf8");
}

// Create components/<Name>Page/
const pageDir = join(featureDir, "components", `${Name}Page`);

mkdirSync(pageDir, { recursive: true });

const providersImport = relative(
  pageDir,
  resolve(process.cwd(), "tests/render-with-providers")
)
  .split(sep)
  .join("/");

const pageFiles: Record<string, string> = {
  [`${Name}Page.types.ts`]: `export interface I${Name}PageView {
  readonly isLoading: boolean;
  readonly showEmpty: boolean;
}
`,
  [`${Name}Page.constants.ts`]: `export const ${Name.toUpperCase()}_PAGE_I18N_KEYS = {
  title: "features.${lower}.title",
  empty: "features.${lower}.empty"
} as const;
`,
  [`${Name}Page.hooks.ts`]: `import { use${Name} } from "@/features/${lower}/${Name}.queries";
import type { I${Name}PageView } from "./${Name}Page.types";

export function use${Name}Page(): I${Name}PageView {
  const query = use${Name}();
  const hasItems = (query.data?.length ?? 0) > 0;

  return {
    isLoading: query.isPending,
    showEmpty: !query.isPending && !hasItems
  };
}
`,
  [`${Name}Page.tsx`]: `import type { FC } from "react";

import { Helmet } from "react-helmet-async";
${namespaceEnabled ? 'import { useNamespace } from "@/lib/i18n/useNamespace";' : 'import { useTranslation } from "react-i18next";'}

import { use${Name}Page } from "./${Name}Page.hooks";
import { ${Name.toUpperCase()}_PAGE_I18N_KEYS } from "./${Name}Page.constants";

const ${Name}Page: FC = () => {
  const { t } = ${namespaceEnabled ? `useNamespace(${JSON.stringify(lower)})` : "useTranslation()"};
  const { isLoading, showEmpty } = use${Name}Page();

  return (
    <main className='min-h-screen p-6'>
      <Helmet>
        <title>{t(${Name.toUpperCase()}_PAGE_I18N_KEYS.title)}</title>
      </Helmet>
      <h1 className='text-2xl font-semibold'>
        {t(${Name.toUpperCase()}_PAGE_I18N_KEYS.title)}
      </h1>
      {isLoading ? (
        <p role='status' aria-live='polite' className='text-muted-foreground mt-4'>
          {t("common.loading")}
        </p>
      ) : null}
      {showEmpty ? (
        <p className='text-muted-foreground mt-4'>
          {t(${Name.toUpperCase()}_PAGE_I18N_KEYS.empty)}
        </p>
      ) : null}
    </main>
  );
};

${Name}Page.displayName = "${Name}Page";

export default ${Name}Page;
export { ${Name}Page };
`,
  [`${Name}Page.stories.tsx`]: `import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ${Name}Page from "./${Name}Page";

const meta: Meta<typeof ${Name}Page> = {
  title: "Features/${Name}/${Name}Page",
  component: ${Name}Page,
  decorators: [
    (Story) => {
      const client = new QueryClient();
      return (
        <QueryClientProvider client={client}>
          <MemoryRouter><Story /></MemoryRouter>
        </QueryClientProvider>
      );
    }
  ]
};
export default meta;

type IStory = StoryObj<typeof ${Name}Page>;

export const Default: IStory = {};
`,
  [`${Name}Page.test.tsx`]: `import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { renderWithProviders } from "${providersImport}";
import ${Name}Page from "./${Name}Page";

describe("${Name}Page", () => {
  it("renders the translated heading", async () => {
    await renderWithProviders(<HelmetProvider><${Name}Page /></HelmetProvider>, {
      resources: { en: { ${namespaceEnabled ? lower : "common"}: {
        features: { ${lower}: { title: "${Name}", empty: "Empty" } },
        common: { loading: "Loading" }
      } } }
    });
    expect(screen.getByRole("heading", { level: 1, name: "${Name}" })).toBeInTheDocument();
  });
});
`,
  [`index.ts`]: `export { default as ${Name}Page } from "./${Name}Page";
`
};

for (const [file, content] of Object.entries(pageFiles)) {
  writeFileSync(join(pageDir, file), content, "utf8");
}

if (namespaceEnabled) {
  const dictionary = {
    features: { [lower]: { title: Name, empty: `No ${lower} yet.` } },
    common: { loading: "Loading…" }
  };

  for (const path of namespacePaths) {
    writeFileSync(
      path,
      `${JSON.stringify(dictionary, null, 2)}
`,
      "utf8"
    );
  }

  budgets.push({
    name: `${Name} translations (all locales)`,
    path: `dist/assets/${lower}-*.js`,
    limit: "10 KB",
    gzip: true
  });
  writeFileSync(
    budgetPath,
    `${JSON.stringify(budgets, null, 2)}
`,
    "utf8"
  );
}

console.log(
  `[new:feature] Created feature '${Name}' at ${featureDir}
` +
    `  • ${String(Object.keys(dotFiles).length)} dot-suffix files
` +
    `  • components/${Name}Page/ with ${String(Object.keys(pageFiles).length)} files

` +
    `Next: register the route in src/app/router/routes.tsx, add a query hook in ${Name}.queries.ts, and translate every visible string. Namespace dictionaries contain English placeholders in every locale; replace them before shipping.`
);
