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
  },
  /*
   * Inject a synthetic VITE_VAPID_PUBLIC_KEY for Storybook builds so
   * stories of components that read `env.VITE_VAPID_PUBLIC_KEY` (e.g.
   * the WebPushCard's "ready to subscribe" state) can actually render
   * the configured branch. The value is read at module-import time by
   * `src/lib/env/env.loader.ts`, so it can't be overridden per-story
   * without restructuring the env module. A dummy P-256 public key is
   * fine here: stories never call `pushManager.subscribe()`, they only
   * inspect whether the value is non-empty.
   */
  viteFinal(viteConfig) {
    process.env.VITE_VAPID_PUBLIC_KEY ??=
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCC395aLN4dRfx-DH3kZBjxg30zCxnT1KMxr2RC_kdNbQ_AVBfBFA";

    return viteConfig;
  }
};

export default config;
