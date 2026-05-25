import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  typescript: {
    /*
     * `react-docgen` (the non-TS variant) is faster, doesn't try to resolve
     * package.json for transitive deps (`radix-ui` etc.), and doesn't require
     * .storybook/preview.tsx to be in the active TS project. We lose some
     * prop-type richness in the Controls addon — but in exchange the build
     * is noise-free and ~30% faster.
     */
    check: false,
    reactDocgen: "react-docgen"
  },
  docs: {
    defaultName: "Docs"
  }
};

export default config;
