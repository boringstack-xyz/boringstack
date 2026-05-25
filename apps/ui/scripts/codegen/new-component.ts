#!/usr/bin/env tsx
/**
 * Scaffold a new component folder with the 8-file anatomy.
 *
 *   bun run new:component core/Card
 *   bun run new:feature-component auth/PasswordStrengthMeter
 *
 * Refuses to overwrite existing files.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src", "components");

function bail(message: string): never {
  console.error(`[new:component] ${message}`);
  process.exit(1);
}

const arg = process.argv[2];

if (typeof arg !== "string" || arg.length === 0) {
  bail("Usage: bun run new:component <core|global>/<ComponentName>");
}

const [bucket, ...rest] = arg.split("/");
const name = rest.join("/");

if (
  bucket === undefined ||
  (bucket !== "core" && bucket !== "global" && bucket !== "ui")
) {
  bail(`Bucket must be 'core', 'global', or 'ui' (got '${String(bucket)}')`);
}

if (!/^[A-Z][A-Za-z0-9]+$/.test(name)) {
  bail(`Component name must be PascalCase (got '${name}')`);
}

const targetDir = join(SRC, bucket, name);

if (existsSync(targetDir)) {
  bail(`Directory already exists: ${targetDir}`);
}

mkdirSync(targetDir, { recursive: true });

const files: Record<string, string> = {
  [`${name}.types.ts`]: `export interface I${name}Props {\n  readonly className?: string;\n}\n\nexport interface I${name}View {\n  readonly className: string | undefined;\n}\n`,
  [`${name}.constants.ts`]: `export const ${name.toUpperCase()}_DEFAULTS = Object.freeze({});\n`,
  [`${name}.hooks.ts`]: `import type { I${name}Props, I${name}View } from "./${name}.types";\n\nexport function use${name}(props: I${name}Props): I${name}View {\n  return { className: props.className };\n}\n`,
  [`${name}.tsx`]: `import type { FC } from "react";\nimport { cn } from "@/lib/classnames";\nimport { use${name} } from "./${name}.hooks";\nimport type { I${name}Props } from "./${name}.types";\n\nconst ${name}: FC<I${name}Props> = (props) => {\n  const { className } = use${name}(props);\n  return <div className={cn("", className)} data-testid="${name.toLowerCase()}" />;\n};\n\n${name}.displayName = "${name}";\n\nexport default ${name};\nexport { ${name} };\n`,
  [`${name}.stories.tsx`]: `import type { Meta, StoryObj } from "@storybook/react-vite";\nimport ${name} from "./${name}";\n\nconst meta: Meta<typeof ${name}> = {\n  title: "Components/${bucket}/${name}",\n  component: ${name}\n};\nexport default meta;\n\ntype IStory = StoryObj<typeof ${name}>;\n\nexport const Default: IStory = {};\n`,
  [`${name}.test.tsx`]: `import { describe, it, expect } from "vitest";\nimport { render, screen } from "@testing-library/react";\nimport ${name} from "./${name}";\n\ndescribe("${name}", () => {\n  it("renders", () => {\n    render(<${name} />);\n    expect(screen.getByTestId("${name.toLowerCase()}")).toBeInTheDocument();\n  });\n});\n`,
  [`index.ts`]: `export { default as ${name} } from "./${name}";\nexport * from "./${name}.types";\n`
};

for (const [file, content] of Object.entries(files)) {
  const path = join(targetDir, file);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

console.log(
  `[new:component] Created ${String(Object.keys(files).length)} files under ${targetDir}`
);
