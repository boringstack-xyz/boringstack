#!/usr/bin/env tsx
/**
 * Scaffold a new feature folder.
 *
 *   bun run new:feature Posts
 *
 * Creates src/features/posts/ with all dot-suffix files filled in
 * (constants, schemas, types, queries, store, utils) and a starter
 * components/<Feature>Page/ component.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src", "features");

function bail(message: string): never {
  console.error(`[new:feature] ${message}`);
  process.exit(1);
}

const arg = process.argv[2];

if (typeof arg !== "string" || arg.length === 0) {
  bail("Usage: bun run new:feature <Name>");
}

if (!/^[A-Z][A-Za-z0-9]+$/.test(arg)) {
  bail(`Feature name must be PascalCase (got '${arg}')`);
}

const Name = arg;
const lower = Name.toLowerCase();
const featureDir = join(SRC, lower);

if (existsSync(featureDir)) {
  bail(`Feature already exists: ${featureDir}`);
}

mkdirSync(featureDir, { recursive: true });

const dotFiles: Record<string, string> = {
  [`${Name}.constants.ts`]: `export const ${Name.toUpperCase()}_QUERY_KEYS = {\n  list: ["${lower}", "list"] as const\n};\n`,
  [`${Name}.schemas.ts`]: `import { z } from "zod";\n\nexport const ${lower}ItemSchema = z.object({\n  id: z.uuid(),\n  createdAt: z.string()\n});\n`,
  [`${Name}.types.ts`]: `import type { z } from "zod";\nimport type { ${lower}ItemSchema } from "./${Name}.schemas";\n\nexport type I${Name}Item = z.infer<typeof ${lower}ItemSchema>;\n`,
  [`${Name}.utils.ts`]: `import type { I${Name}Item } from "./${Name}.types";\n\nexport function sort${Name}ByCreated(items: readonly I${Name}Item[]): I${Name}Item[] {\n  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));\n}\n`,
  [`${Name}.queries.ts`]: `import { useQuery, type UseQueryResult } from "@tanstack/react-query";\nimport { ${Name.toUpperCase()}_QUERY_KEYS } from "./${Name}.constants";\nimport type { I${Name}Item } from "./${Name}.types";\n\n/**\n * Replace the queryFn stub with a typed call:\n *\n *   import { apiClient } from "@/lib/api/client";\n *   queryFn: async (): Promise<I${Name}Item[]> => {\n *     const { data } = await apiClient.GET("/api/${lower}");\n *     return data ?? [];\n *   }\n *\n * Run \`bun run generate:api\` after the endpoint is added to the OpenAPI spec.\n */\nexport function use${Name}(): UseQueryResult<I${Name}Item[]> {\n  return useQuery({\n    queryKey: ${Name.toUpperCase()}_QUERY_KEYS.list,\n    queryFn: async (): Promise<I${Name}Item[]> => Promise.resolve([])\n  });\n}\n`,
  [`${Name}.store.ts`]: `import { create } from "zustand";\n\ninterface I${Name}State {\n  readonly selectedId: string | null;\n  setSelected(id: string | null): void;\n}\n\nexport const use${Name}Store = create<I${Name}State>((set) => ({\n  selectedId: null,\n  setSelected: (id) => {\n    set({ selectedId: id });\n  }\n}));\n`
};

for (const [file, content] of Object.entries(dotFiles)) {
  writeFileSync(join(featureDir, file), content, "utf8");
}

// Create components/<Name>Page/
const pageDir = join(featureDir, "components", `${Name}Page`);

mkdirSync(pageDir, { recursive: true });

const pageFiles: Record<string, string> = {
  [`${Name}Page.types.ts`]: `export interface I${Name}PageView {\n  readonly isLoading: boolean;\n  readonly showEmpty: boolean;\n}\n`,
  [`${Name}Page.constants.ts`]: `export const ${Name.toUpperCase()}_PAGE_I18N_KEYS = {\n  title: "features.${lower}.title",\n  empty: "features.${lower}.empty"\n} as const;\n`,
  [`${Name}Page.hooks.ts`]: `import { use${Name} } from "@/features/${lower}/${Name}.queries";\nimport type { I${Name}PageView } from "./${Name}Page.types";\n\nexport function use${Name}Page(): I${Name}PageView {\n  const query = use${Name}();\n  const hasItems = (query.data?.length ?? 0) > 0;\n\n  return {\n    isLoading: query.isPending,\n    showEmpty: !query.isPending && !hasItems\n  };\n}\n`,
  [`${Name}Page.tsx`]: `import type { FC } from "react";\n\nimport { Helmet } from "react-helmet-async";\nimport { useTranslation } from "react-i18next";\n\nimport { use${Name}Page } from "./${Name}Page.hooks";\nimport { ${Name.toUpperCase()}_PAGE_I18N_KEYS } from "./${Name}Page.constants";\n\nconst ${Name}Page: FC = () => {\n  const { t } = useTranslation();\n  const { isLoading, showEmpty } = use${Name}Page();\n\n  return (\n    <main className='min-h-screen p-6'>\n      <Helmet>\n        <title>{t(${Name.toUpperCase()}_PAGE_I18N_KEYS.title)}</title>\n      </Helmet>\n      <h1 className='text-2xl font-semibold'>\n        {t(${Name.toUpperCase()}_PAGE_I18N_KEYS.title)}\n      </h1>\n      {isLoading ? (\n        <p role='status' aria-live='polite' className='text-muted-foreground mt-4'>\n          {t("common.loading")}\n        </p>\n      ) : null}\n      {showEmpty ? (\n        <p className='text-muted-foreground mt-4'>\n          {t(${Name.toUpperCase()}_PAGE_I18N_KEYS.empty)}\n        </p>\n      ) : null}\n    </main>\n  );\n};\n\n${Name}Page.displayName = "${Name}Page";\n\nexport default ${Name}Page;\nexport { ${Name}Page };\n`,
  [`${Name}Page.stories.tsx`]: `import type { Meta, StoryObj } from "@storybook/react-vite";\nimport { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { MemoryRouter } from "react-router-dom";\nimport ${Name}Page from "./${Name}Page";\n\nconst meta: Meta<typeof ${Name}Page> = {\n  title: "Features/${Name}/${Name}Page",\n  component: ${Name}Page,\n  decorators: [\n    (Story) => {\n      const client = new QueryClient();\n      return (\n        <QueryClientProvider client={client}>\n          <MemoryRouter><Story /></MemoryRouter>\n        </QueryClientProvider>\n      );\n    }\n  ]\n};\nexport default meta;\n\ntype IStory = StoryObj<typeof ${Name}Page>;\n\nexport const Default: IStory = {};\n`,
  [`${Name}Page.test.tsx`]: `import { describe, it, expect } from "vitest";\nimport { render, screen } from "@testing-library/react";\nimport { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { MemoryRouter } from "react-router-dom";\nimport ${Name}Page from "./${Name}Page";\n\ndescribe("${Name}Page", () => {\n  it("renders the heading", () => {\n    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });\n    render(\n      <QueryClientProvider client={client}>\n        <MemoryRouter><${Name}Page /></MemoryRouter>\n      </QueryClientProvider>\n    );\n    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();\n  });\n});\n`,
  [`index.ts`]: `export { default as ${Name}Page } from "./${Name}Page";\n`
};

for (const [file, content] of Object.entries(pageFiles)) {
  writeFileSync(join(pageDir, file), content, "utf8");
}

console.log(
  `[new:feature] Created feature '${Name}' at ${featureDir}\n` +
    `  • ${String(Object.keys(dotFiles).length)} dot-suffix files\n` +
    `  • components/${Name}Page/ with ${String(Object.keys(pageFiles).length)} files\n\n` +
    `Next: register the route in src/app/router/routes.tsx, add a query hook in ${Name}.queries.ts, and translate every visible string.`
);
