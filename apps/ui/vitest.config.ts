import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}"
    ],
    exclude: ["node_modules", "dist", "e2e", "playwright-report"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.stories.tsx",
        "src/**/*.types.ts",
        "src/**/*.constants.ts",
        "src/**/*.schemas.ts",
        "src/**/index.ts",
        "src/app/main.tsx",
        "src/app/App.tsx",
        "src/app/router/routes.tsx",
        "src/app/providers/**",
        "src/components/ui/**",
        "src/components/global/**",
        "src/assets/**",
        "src/lib/i18n/**",
        "src/vite-env.d.ts"
      ],
      // Coverage thresholds — we exclude shadcn primitives, route declarations,
      // i18n init glue, and declarative file suffixes. The global floor is
      // intentionally modest; feature PRs should still add focused tests for
      // new queries, stores, hooks, and utilities.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      }
    },
    restoreMocks: true,
    clearMocks: true
  }
});
